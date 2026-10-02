begin;
alter table public.learning_sessions add column if not exists reasoning_ready boolean not null default false;
alter table public.learning_sessions add column if not exists reasoning_summary text not null default '' check(octet_length(reasoning_summary)<=6000);
alter table public.learning_sessions add column if not exists reasoning_graph jsonb check(reasoning_graph is null or (jsonb_typeof(reasoning_graph)='object' and octet_length(reasoning_graph::text)<=20000));
create or replace function public.save_learning_progress(p_user_id uuid,p_code text,p_step smallint,p_unlocked smallint)
returns boolean language plpgsql security definer set search_path='' as $$
declare session public.learning_sessions%rowtype;
begin
  select * into session from public.learning_sessions where user_id=p_user_id and challenge_id='contains-duplicate' for update;
  if not found then return false; end if;
  -- A stale browser autosave must not undo a map/stage saved by the mentor.
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
