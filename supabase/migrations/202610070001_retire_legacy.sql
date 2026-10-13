begin;
-- The Fargate runner and the mentor-chat flow are retired. Code checks run in the
-- web server sandbox; the canvas studio replaced the chat. Their service functions go.
-- The execution_jobs, execution_budget tables and the legacy learning_sessions
-- columns (messages, step, unlocked, reasoning_*) are left in place; nothing reads
-- or writes them any more, and dropping them is a separate deliberate cleanup.
drop function if exists public.reserve_execution(uuid,text);
drop function if exists public.save_learning_progress(uuid,text,smallint,smallint);
notify pgrst,'reload schema';
commit;
