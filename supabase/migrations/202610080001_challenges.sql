begin;
-- One learning session per (user, challenge). Any challenge id is allowed; the
-- application validates ids against its challenge catalogue.
alter table public.learning_sessions drop constraint if exists learning_sessions_challenge_id_check;
alter table public.learning_sessions add constraint learning_sessions_challenge_id_check check (length(challenge_id) between 1 and 80);
alter table public.learning_sessions alter column challenge_id drop default;
create index if not exists learning_sessions_class_user on public.learning_sessions(classroom_id,user_id);
create index if not exists studio_events_owner_challenge_time on public.studio_events(user_id,challenge_id,created_at desc);

-- A student has at most one active class; it applies to every challenge they open.
alter table public.classroom_members add column if not exists active boolean not null default true;

create or replace function public.open_studio_session(p_user_id uuid,p_challenge_id text,p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.learning_sessions%rowtype;
begin
 insert into public.learning_sessions(user_id,challenge_id,code,classroom_id)
 select p_user_id,p_challenge_id,p_code,(select classroom_id from public.classroom_members where user_id=p_user_id and active order by joined_at desc limit 1)
 on conflict (user_id,challenge_id) do nothing;
 select * into s from public.learning_sessions where user_id=p_user_id and challenge_id=p_challenge_id;
 return jsonb_build_object('blueprint',s.blueprint,'code',s.code,'blueprint_revision',s.blueprint_revision,'blueprint_note',s.blueprint_note,'draft_hash',s.draft_hash,'classroom_id',s.classroom_id);
end; $$;

drop function if exists public.record_studio_event(uuid,text,jsonb,jsonb,integer);
create or replace function public.record_studio_event(p_user_id uuid,p_challenge_id text,p_kind text,p_detail jsonb,p_blueprint jsonb default null,p_expected_revision integer default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare s public.learning_sessions%rowtype; event_id uuid;
begin
 select * into s from public.learning_sessions where user_id=p_user_id and challenge_id=p_challenge_id for update;
 if not found then raise exception 'SESSION_NOT_FOUND'; end if;
 if p_expected_revision is not null and s.blueprint_revision<>p_expected_revision then raise exception 'REVISION_CONFLICT'; end if;
 if (select count(*) from public.studio_events where user_id=p_user_id and created_at>now()-interval '24 hours')>=500 then raise exception 'EVENT_LIMIT'; end if;
 insert into public.studio_events(user_id,classroom_id,challenge_id,kind,detail,blueprint,revision) values(p_user_id,s.classroom_id,p_challenge_id,p_kind,p_detail,p_blueprint,s.blueprint_revision) returning id into event_id;
 return event_id;
end; $$;

drop function if exists public.save_studio_canvas(uuid,jsonb,text,integer,boolean,boolean);
create or replace function public.save_studio_canvas(p_user_id uuid,p_challenge_id text,p_blueprint jsonb,p_code text,p_revision integer,p_same_blueprint boolean,p_same_draft boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.learning_sessions%rowtype;
begin
 select * into s from public.learning_sessions where user_id=p_user_id and challenge_id=p_challenge_id for update;
 if not found or s.blueprint_revision<>p_revision then raise exception 'REVISION_CONFLICT'; end if;
 update public.learning_sessions set blueprint=p_blueprint,code=p_code,blueprint_revision=p_revision+1,draft_hash=case when p_same_draft then s.draft_hash else null end,
 blueprint_note=case when p_same_blueprint then s.blueprint_note else '' end,updated_at=now() where id=s.id returning * into s;
 if not p_same_blueprint then perform public.record_studio_event(p_user_id,p_challenge_id,'blueprint_saved','{}',p_blueprint); end if;
 return jsonb_build_object('blueprint',s.blueprint,'code',s.code,'blueprint_revision',s.blueprint_revision,'blueprint_note',s.blueprint_note,'draft_hash',s.draft_hash,'classroom_id',s.classroom_id);
end; $$;

drop function if exists public.commit_studio_draft(uuid,integer,text,text,text,text);
create or replace function public.commit_studio_draft(p_user_id uuid,p_challenge_id text,p_revision integer,p_code text,p_hash text,p_note text,p_graph_key text,p_checked integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.learning_sessions%rowtype; c public.classrooms%rowtype;
begin
 select * into s from public.learning_sessions where user_id=p_user_id and challenge_id=p_challenge_id for update;
 if not found or s.blueprint_revision<>p_revision then raise exception 'REVISION_CONFLICT'; end if;
 if exists(select 1 from public.studio_events where user_id=p_user_id and challenge_id=p_challenge_id and kind='simulation' and detail->>'graphKey'=p_graph_key and detail->>'passed'='false') then raise exception 'COUNTEREXAMPLE_FOUND'; end if;
 if s.classroom_id is not null then
   select * into c from public.classrooms where id=s.classroom_id for share;
   if not found or not c.allow_code then raise exception 'DRAFTING_DISABLED'; end if;
   if c.require_prediction and not exists(select 1 from public.studio_events where user_id=p_user_id and classroom_id=c.id and challenge_id=p_challenge_id and kind='prediction' and detail->>'graphKey'=p_graph_key and detail->>'correct'='true') then raise exception 'PREDICTION_REQUIRED'; end if;
 end if;
 update public.learning_sessions set code=p_code,draft_hash=p_hash,blueprint_note=p_note,blueprint_revision=p_revision+1,updated_at=now() where id=s.id returning * into s;
 perform public.record_studio_event(p_user_id,p_challenge_id,'code_verified',jsonb_build_object('checked',p_checked),s.blueprint);
 return jsonb_build_object('blueprint',s.blueprint,'code',s.code,'blueprint_revision',s.blueprint_revision,'blueprint_note',s.blueprint_note,'draft_hash',s.draft_hash,'classroom_id',s.classroom_id);
end; $$;

drop function if exists public.join_studio_class(uuid,uuid,text);
create or replace function public.join_studio_class(p_user_id uuid,p_code uuid,p_name text,p_challenge_id text)
returns uuid language plpgsql security definer set search_path='' as $$
declare class_id uuid; current_graph jsonb;
begin
 select id into class_id from public.classrooms where join_code=p_code and owner_id<>p_user_id;
 if not found then raise exception 'CLASS_NOT_FOUND'; end if;
 update public.classroom_members set active=false where user_id=p_user_id and classroom_id<>class_id;
 insert into public.classroom_members(classroom_id,user_id,display_name,active) values(class_id,p_user_id,p_name,true) on conflict(classroom_id,user_id) do update set display_name=excluded.display_name,active=true;
 update public.learning_sessions set classroom_id=class_id where user_id=p_user_id;
 select blueprint into current_graph from public.learning_sessions where user_id=p_user_id and challenge_id=p_challenge_id;
 if not found then raise exception 'SESSION_NOT_FOUND'; end if;
 perform public.record_studio_event(p_user_id,p_challenge_id,'joined',jsonb_build_object('name',p_name),coalesce(current_graph,'{"nodes":[{"id":"input","op":"start","label":"Input","x":200,"y":70}],"edges":[]}'::jsonb));
 return class_id;
end; $$;

create or replace function public.leave_studio_class(p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 update public.classroom_members set active=false where user_id=p_user_id;
 update public.learning_sessions set classroom_id=null where user_id=p_user_id;
end; $$;

revoke all on function public.open_studio_session(uuid,text,text),public.record_studio_event(uuid,text,text,jsonb,jsonb,integer),public.save_studio_canvas(uuid,text,jsonb,text,integer,boolean,boolean),public.commit_studio_draft(uuid,text,integer,text,text,text,text,integer),public.join_studio_class(uuid,uuid,text,text),public.leave_studio_class(uuid) from public,anon,authenticated;
grant execute on function public.open_studio_session(uuid,text,text),public.record_studio_event(uuid,text,text,jsonb,jsonb,integer),public.save_studio_canvas(uuid,text,jsonb,text,integer,boolean,boolean),public.commit_studio_draft(uuid,text,integer,text,text,text,text,integer),public.join_studio_class(uuid,uuid,text,text),public.leave_studio_class(uuid) to service_role;
notify pgrst,'reload schema';
commit;
