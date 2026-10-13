begin;
-- Read-only public snapshots of a blueprint and its code, created deliberately by the owner.
create table if not exists public.blueprint_shares (
  id uuid primary key default gen_random_uuid(),
  token text not null unique check (token ~ '^[a-z0-9]{12}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id text not null check (length(challenge_id) between 1 and 80),
  blueprint jsonb not null check (jsonb_typeof(blueprint)='object' and octet_length(blueprint::text)<=30000),
  code text not null default '' check (length(code)<=15000),
  note text not null default '' check (length(note)<=300),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists blueprint_shares_owner on public.blueprint_shares(user_id,created_at desc);
alter table public.blueprint_shares enable row level security;
-- Owners can list their shares; the public page reads through the service role by token only.
drop policy if exists share_owner_read on public.blueprint_shares;
create policy share_owner_read on public.blueprint_shares for select to authenticated using(user_id=auth.uid());
revoke all on public.blueprint_shares from anon,authenticated;
grant select on public.blueprint_shares to authenticated;
grant all on public.blueprint_shares to service_role;
create or replace function public.create_blueprint_share(p_user_id uuid,p_challenge_id text,p_token text,p_note text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.learning_sessions%rowtype; share public.blueprint_shares%rowtype;
begin
 select * into s from public.learning_sessions where user_id=p_user_id and challenge_id=p_challenge_id;
 if not found or s.blueprint is null then raise exception 'NOTHING_TO_SHARE'; end if;
 if (select count(*) from public.blueprint_shares where user_id=p_user_id and created_at>now()-interval '24 hours')>=20 then raise exception 'SHARE_LIMIT'; end if;
 insert into public.blueprint_shares(token,user_id,challenge_id,blueprint,code,note,verified) values(p_token,p_user_id,p_challenge_id,s.blueprint,s.code,p_note,s.draft_hash is not null) returning * into share;
 return jsonb_build_object('token',share.token,'created_at',share.created_at);
end; $$;
revoke all on function public.create_blueprint_share(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.create_blueprint_share(uuid,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
