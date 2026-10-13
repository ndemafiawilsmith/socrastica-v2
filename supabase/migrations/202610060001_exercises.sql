begin;
create table if not exists public.exercise_sessions (
 user_id uuid not null references auth.users(id) on delete cascade,
 exercise_id text not null check(length(exercise_id)<=80),
 plan jsonb not null default '[]' check(jsonb_typeof(plan)='array' and octet_length(plan::text)<=4000),
 code text not null default '' check(length(code)<=15000), reflection text not null default '' check(length(reflection)<=1000),
 revision integer not null default 0, verified boolean not null default false, updated_at timestamptz not null default now(),
 primary key(user_id,exercise_id)
);
alter table public.exercise_sessions enable row level security;
drop policy if exists exercise_self_read on public.exercise_sessions;
create policy exercise_self_read on public.exercise_sessions for select to authenticated using(user_id=auth.uid());
revoke all on public.exercise_sessions from anon,authenticated;
grant select on public.exercise_sessions to authenticated;
grant all on public.exercise_sessions to service_role;
create table if not exists public.exercise_run_requests(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now());
create index if not exists exercise_runs_owner_time on public.exercise_run_requests(user_id,created_at desc);
alter table public.exercise_run_requests enable row level security;
revoke all on public.exercise_run_requests from anon,authenticated;
grant all on public.exercise_run_requests to service_role;
create or replace function public.reserve_exercise_run(p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,724));
 if exists(select 1 from public.exercise_run_requests where user_id=p_user_id and created_at>now()-interval '10 seconds') then raise exception 'PLEASE_WAIT'; end if;
 if (select count(*) from public.exercise_run_requests where user_id=p_user_id and created_at>now()-interval '24 hours')>=50 then raise exception 'DAILY_LIMIT'; end if;
 delete from public.exercise_run_requests where user_id=p_user_id and created_at<now()-interval '24 hours';
 insert into public.exercise_run_requests(user_id) values(p_user_id);
end; $$;
create or replace function public.save_exercise_session(p_user_id uuid,p_exercise_id text,p_revision integer,p_plan jsonb,p_code text,p_reflection text,p_verified boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.exercise_sessions%rowtype;
begin
 select * into s from public.exercise_sessions where user_id=p_user_id and exercise_id=p_exercise_id for update;
 if not found or s.revision<>p_revision then raise exception 'REVISION_CONFLICT'; end if;
 update public.exercise_sessions set plan=p_plan,code=p_code,reflection=p_reflection,verified=p_verified,revision=p_revision+1,updated_at=now() where user_id=p_user_id and exercise_id=p_exercise_id returning * into s;
 return to_jsonb(s)-'user_id';
end; $$;
revoke all on function public.reserve_exercise_run(uuid),public.save_exercise_session(uuid,text,integer,jsonb,text,text,boolean) from public,anon,authenticated;
grant execute on function public.reserve_exercise_run(uuid),public.save_exercise_session(uuid,text,integer,jsonb,text,text,boolean) to service_role;
notify pgrst,'reload schema';
commit;
