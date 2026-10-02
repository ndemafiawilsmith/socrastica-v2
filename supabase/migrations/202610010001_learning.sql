begin;

create table if not exists public.learning_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id text not null default 'contains-duplicate' check (challenge_id = 'contains-duplicate'),
  step smallint not null default 0 check (step between 0 and 3),
  unlocked smallint not null default 0 check (unlocked between 0 and 3 and step <= unlocked),
  code text not null default '' check (octet_length(code) <= 50000),
  messages jsonb not null default '[]'::jsonb check (jsonb_typeof(messages) = 'array' and jsonb_array_length(messages) <= 101 and octet_length(messages::text) <= 300000),
  revision integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, challenge_id)
);
alter table public.learning_sessions enable row level security;
revoke all on public.learning_sessions from anon, authenticated;
grant select on public.learning_sessions to authenticated;
grant all on public.learning_sessions to service_role;
drop policy if exists "Read own sessions" on public.learning_sessions;
create policy "Read own sessions" on public.learning_sessions for select to authenticated using ((select auth.uid()) = user_id);
-- All writes go through authenticated server routes with explicit ownership checks.

create table if not exists public.ai_budget (
  id boolean primary key default true check (id),
  reserved_microdollars bigint not null default 0 check (reserved_microdollars >= 0),
  limit_microdollars bigint not null default 2000000 check (limit_microdollars between 0 and 2000000)
);
insert into public.ai_budget(id) values(true) on conflict do nothing;
alter table public.ai_budget enable row level security;
revoke all on public.ai_budget from anon, authenticated;
grant all on public.ai_budget to service_role;

create table if not exists public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  status text not null default 'reserved' check (status in ('reserved','completed','failed')),
  input_tokens integer,
  output_tokens integer
);
create index if not exists ai_requests_user_created on public.ai_requests(user_id, created_at desc);
alter table public.ai_requests enable row level security;
revoke all on public.ai_requests from anon, authenticated;
grant all on public.ai_requests to service_role;

-- Locks one global row: concurrent requests cannot race past the shared allowance.
-- Reserve $0.01 per attempt, never refund automatically, stop at $2 total.
create or replace function public.reserve_mentor_request(p_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare budget public.ai_budget%rowtype; request_id uuid;
begin
  if p_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into budget from public.ai_budget where id = true for update;
  if not found or budget.reserved_microdollars + 10000 > budget.limit_microdollars then
    raise exception 'TEST_BUDGET_EXHAUSTED';
  end if;
  if exists(select 1 from public.ai_requests where user_id = p_user_id and
    (created_at > now() - interval '10 seconds' or (status = 'reserved' and created_at > now() - interval '2 minutes'))) then
    raise exception 'PLEASE_WAIT';
  end if;
  if (select count(*) from public.ai_requests where user_id = p_user_id and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'DAILY_LIMIT_REACHED';
  end if;
  update public.ai_budget set reserved_microdollars = reserved_microdollars + 10000 where id = true;
  insert into public.ai_requests(user_id) values(p_user_id) returning id into request_id;
  return request_id;
end;
$$;
revoke all on function public.reserve_mentor_request(uuid) from public, anon, authenticated;
grant execute on function public.reserve_mentor_request(uuid) to service_role;

notify pgrst, 'reload schema';
commit;
