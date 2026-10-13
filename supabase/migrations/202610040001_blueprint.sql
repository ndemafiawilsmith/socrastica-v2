begin;
alter table public.learning_sessions add column if not exists blueprint jsonb check(blueprint is null or (jsonb_typeof(blueprint)='object' and octet_length(blueprint::text)<=30000));
alter table public.learning_sessions add column if not exists blueprint_revision integer not null default 0;
alter table public.learning_sessions add column if not exists blueprint_note text not null default '' check(octet_length(blueprint_note)<=3000);
alter table public.learning_sessions add column if not exists draft_hash text;
-- Old tabs must not overwrite code in a canvas session without its revision check.
create or replace function public.save_learning_progress(p_user_id uuid,p_code text,p_step smallint,p_unlocked smallint)
returns boolean language plpgsql security definer set search_path='' as $$
declare session public.learning_sessions%rowtype;
begin
  select * into session from public.learning_sessions where user_id=p_user_id and challenge_id='contains-duplicate' for update;
  if not found then return false; end if;
  if session.blueprint is not null and p_code<>session.code then return false; end if;
  update public.learning_sessions set code=p_code,
    step=case when p_unlocked<session.unlocked then session.step else least(p_step,case when session.reasoning_ready then 3 else 1 end) end,
    unlocked=greatest(case when session.reasoning_ready then session.unlocked else least(session.unlocked,1) end,least(p_unlocked,case when session.reasoning_ready then 3 else 1 end)),
    updated_at=now()
    where id=session.id;
  return true;
end;
$$;
revoke all on function public.save_learning_progress(uuid,text,smallint,smallint) from public,anon,authenticated;
grant execute on function public.save_learning_progress(uuid,text,smallint,smallint) to service_role;
notify pgrst,'reload schema';
commit;
