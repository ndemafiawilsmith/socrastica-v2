begin;
create table if not exists public.classrooms (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(length(name) between 1 and 80), join_code uuid not null unique default gen_random_uuid(),
  hint_depth smallint not null default 2 check(hint_depth between 0 and 2), require_prediction boolean not null default false,
  allow_code boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.classroom_members (
  classroom_id uuid not null references public.classrooms(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check(length(display_name) between 1 and 50), joined_at timestamptz not null default now(), primary key(classroom_id,user_id)
);
alter table public.learning_sessions add column if not exists classroom_id uuid references public.classrooms(id) on delete set null;
create table if not exists public.studio_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  classroom_id uuid references public.classrooms(id) on delete set null, challenge_id text not null default 'contains-duplicate',
  kind text not null check(kind in ('blueprint_saved','ai_direction','code_verified','prediction','reflection','simulation','hint','joined')),
  detail jsonb not null default '{}' check(jsonb_typeof(detail)='object' and octet_length(detail::text)<=12000),
  blueprint jsonb check(blueprint is null or octet_length(blueprint::text)<=30000), revision integer not null, created_at timestamptz not null default now()
);
create index if not exists studio_events_owner_time on public.studio_events(user_id,created_at desc);
create index if not exists studio_events_class_time on public.studio_events(classroom_id,user_id,created_at desc);
create table if not exists public.classroom_feedback (
  classroom_id uuid not null references public.classrooms(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  note text not null default '' check(length(note)<=2000), rubric jsonb not null default '{"memory":"unreviewed","branching":"unreviewed","edge_cases":"unreviewed"}',
  updated_at timestamptz not null default now(), primary key(classroom_id,user_id),
  foreign key(classroom_id,user_id) references public.classroom_members(classroom_id,user_id) on delete cascade
);
alter table public.classrooms enable row level security;
alter table public.classroom_members enable row level security;
alter table public.studio_events enable row level security;
alter table public.classroom_feedback enable row level security;
-- Class codes and other students' identities stay behind ownership-checked server routes.
drop policy if exists classroom_owner_read on public.classrooms;
create policy classroom_owner_read on public.classrooms for select to authenticated using(owner_id=auth.uid());
drop policy if exists member_self_read on public.classroom_members;
create policy member_self_read on public.classroom_members for select to authenticated using(user_id=auth.uid());
drop policy if exists event_self_read on public.studio_events;
create policy event_self_read on public.studio_events for select to authenticated using(user_id=auth.uid());
drop policy if exists feedback_self_read on public.classroom_feedback;
create policy feedback_self_read on public.classroom_feedback for select to authenticated using(user_id=auth.uid());
grant select on public.classrooms,public.classroom_members,public.studio_events,public.classroom_feedback to authenticated;
revoke insert,update,delete on public.classrooms,public.classroom_members,public.studio_events,public.classroom_feedback from anon,authenticated;

create or replace function public.record_studio_event(p_user_id uuid,p_kind text,p_detail jsonb,p_blueprint jsonb default null,p_expected_revision integer default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare s public.learning_sessions%rowtype; event_id uuid;
begin
 select * into s from public.learning_sessions where user_id=p_user_id and challenge_id='contains-duplicate' for update;
 if not found then raise exception 'SESSION_NOT_FOUND'; end if;
 if p_expected_revision is not null and s.blueprint_revision<>p_expected_revision then raise exception 'REVISION_CONFLICT'; end if;
 if (select count(*) from public.studio_events where user_id=p_user_id and created_at>now()-interval '24 hours')>=500 then raise exception 'EVENT_LIMIT'; end if;
 insert into public.studio_events(user_id,classroom_id,kind,detail,blueprint,revision) values(p_user_id,s.classroom_id,p_kind,p_detail,p_blueprint,s.blueprint_revision) returning id into event_id;
 return event_id;
end; $$;
create or replace function public.save_studio_canvas(p_user_id uuid,p_blueprint jsonb,p_code text,p_revision integer,p_same_blueprint boolean,p_same_draft boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.learning_sessions%rowtype;
begin
 select * into s from public.learning_sessions where user_id=p_user_id and challenge_id='contains-duplicate' for update;
 if not found or s.blueprint_revision<>p_revision then raise exception 'REVISION_CONFLICT'; end if;
 update public.learning_sessions set blueprint=p_blueprint,code=p_code,blueprint_revision=p_revision+1,draft_hash=case when p_same_draft then s.draft_hash else null end,
 blueprint_note=case when p_same_blueprint then s.blueprint_note else '' end,updated_at=now() where id=s.id returning * into s;
 if not p_same_blueprint then perform public.record_studio_event(p_user_id,'blueprint_saved','{}',p_blueprint); end if;
 return jsonb_build_object('blueprint',s.blueprint,'code',s.code,'blueprint_revision',s.blueprint_revision,'blueprint_note',s.blueprint_note,'draft_hash',s.draft_hash);
end; $$;
create or replace function public.join_studio_class(p_user_id uuid,p_code uuid,p_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare class_id uuid; current_graph jsonb;
begin
 select id into class_id from public.classrooms where join_code=p_code and owner_id<>p_user_id;
 if not found then raise exception 'CLASS_NOT_FOUND'; end if;
 insert into public.classroom_members(classroom_id,user_id,display_name) values(class_id,p_user_id,p_name) on conflict(classroom_id,user_id) do update set display_name=excluded.display_name;
 update public.learning_sessions set classroom_id=class_id where user_id=p_user_id and challenge_id='contains-duplicate' returning blueprint into current_graph;
 if not found then raise exception 'SESSION_NOT_FOUND'; end if;
 perform public.record_studio_event(p_user_id,'joined',jsonb_build_object('name',p_name),coalesce(current_graph,'{"nodes":[{"id":"input","op":"start","label":"Input array","x":200,"y":70}],"edges":[]}'::jsonb));
 return class_id;
end; $$;
revoke all on function public.record_studio_event(uuid,text,jsonb,jsonb,integer),public.save_studio_canvas(uuid,jsonb,text,integer,boolean,boolean),public.join_studio_class(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.record_studio_event(uuid,text,jsonb,jsonb,integer),public.save_studio_canvas(uuid,jsonb,text,integer,boolean,boolean),public.join_studio_class(uuid,uuid,text) to service_role;
create or replace function public.commit_studio_draft(p_user_id uuid,p_revision integer,p_code text,p_hash text,p_note text,p_graph_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.learning_sessions%rowtype; c public.classrooms%rowtype;
begin
 select * into s from public.learning_sessions where user_id=p_user_id and challenge_id='contains-duplicate' for update;
 if not found or s.blueprint_revision<>p_revision then raise exception 'REVISION_CONFLICT'; end if;
 if exists(select 1 from public.studio_events where user_id=p_user_id and kind='simulation' and detail->>'graphKey'=p_graph_key and detail->>'passed'='false') then raise exception 'COUNTEREXAMPLE_FOUND'; end if;
 if s.classroom_id is not null then
   select * into c from public.classrooms where id=s.classroom_id for share;
   if not found or not c.allow_code then raise exception 'DRAFTING_DISABLED'; end if;
   if c.require_prediction and not exists(select 1 from public.studio_events where user_id=p_user_id and classroom_id=c.id and kind='prediction' and detail->>'graphKey'=p_graph_key and detail->>'correct'='true') then raise exception 'PREDICTION_REQUIRED'; end if;
 end if;
 update public.learning_sessions set code=p_code,draft_hash=p_hash,blueprint_note=p_note,blueprint_revision=p_revision+1,updated_at=now() where id=s.id returning * into s;
 perform public.record_studio_event(p_user_id,'code_verified',jsonb_build_object('checked',40),s.blueprint);
 return jsonb_build_object('blueprint',s.blueprint,'code',s.code,'blueprint_revision',s.blueprint_revision,'blueprint_note',s.blueprint_note,'draft_hash',s.draft_hash);
end; $$;
revoke all on function public.commit_studio_draft(uuid,integer,text,text,text,text) from public,anon,authenticated;
grant execute on function public.commit_studio_draft(uuid,integer,text,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
