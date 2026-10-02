begin;
create table if not exists public.execution_budget (
  id boolean primary key default true check(id),
  reserved integer not null default 0,
  allowance integer not null default 200 check(allowance between 0 and 200)
);
insert into public.execution_budget(id) values(true) on conflict do nothing;
alter table public.execution_budget enable row level security;
revoke all on public.execution_budget from anon, authenticated;
grant all on public.execution_budget to service_role;
create table if not exists public.execution_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  status text not null default 'queued' check(status in ('queued','running','completed','failed')),
  task_arn text,
  result jsonb,
  code_hash text not null
);
create index if not exists execution_jobs_user_created on public.execution_jobs(user_id,created_at desc);
alter table public.execution_jobs enable row level security;
revoke all on public.execution_jobs from anon, authenticated;
grant select on public.execution_jobs to authenticated;
grant all on public.execution_jobs to service_role;
drop policy if exists "Read own executions" on public.execution_jobs;
create policy "Read own executions" on public.execution_jobs for select to authenticated using ((select auth.uid())=user_id);
create or replace function public.reserve_execution(p_user_id uuid,p_code_hash text)
returns uuid language plpgsql security definer set search_path='' as $$
declare budget public.execution_budget%rowtype; job_id uuid;
begin
  if p_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into budget from public.execution_budget where id=true for update;
  if not found or budget.reserved >= budget.allowance then raise exception 'EXECUTION_BUDGET_EXHAUSTED'; end if;
  if exists(select 1 from public.execution_jobs where user_id=p_user_id and (created_at>now()-interval '15 seconds' or (status in ('queued','running') and created_at>now()-interval '5 minutes'))) then raise exception 'PLEASE_WAIT'; end if;
  if (select count(*) from public.execution_jobs where user_id=p_user_id and created_at>now()-interval '24 hours') >=20 then raise exception 'DAILY_LIMIT_REACHED'; end if;
  if (select count(*) from public.execution_jobs where status in ('queued','running') and created_at>now()-interval '5 minutes') >=4 then raise exception 'RUNNERS_BUSY'; end if;
  update public.execution_budget set reserved=reserved+1 where id=true;
  insert into public.execution_jobs(user_id,code_hash) values(p_user_id,p_code_hash) returning id into job_id;
  return job_id;
end;
$$;
revoke all on function public.reserve_execution(uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_execution(uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
