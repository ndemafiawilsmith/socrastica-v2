const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const {createServerClient}=require('@supabase/ssr');
const {ECSClient,DescribeTasksCommand,StopTaskCommand}=require('@aws-sdk/client-ecs');
const {fromIni}=require('@aws-sdk/credential-providers');
require('@next/env').loadEnvConfig(process.cwd());
const base=process.env.EXECUTION_TEST_URL||'http://127.0.0.1:3001';
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const ecs=new ECSClient({region:process.env.AWS_REGION,credentials:fromIni({profile:'socrastica'})});
const users=[];const jobs=[];
async function account() {
  const email=`socrastica-execution-${randomUUID()}@example.com`,password=`${randomUUID()}Aa1!`;
  const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(error);users.push(data.user.id);
  const jar=new Map();
  const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:items=>items.forEach(({name,value})=>jar.set(name,value))}});
  assert.ifError((await client.auth.signInWithPassword({email,password})).error);
  return {id:data.user.id,client,cookie:()=>[...jar].map(([name,value])=>`${name}=${value}`).join('; ')};
}
async function call(path,user,method='GET',body,origin=process.env.NEXT_PUBLIC_APP_URL) {
  const res=await fetch(new URL(path,base),{method,headers:{Cookie:user?.cookie()||'',Origin:origin,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(30000)});
  return {status:res.status,data:await res.json()};
}
async function main() {
  assert.equal((await call('/api/execute')).status,401);
  const first=await account(), second=await account();
  const ref=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
  const guardQuery=`begin;
    do $$ declare uid uuid := '${first.id}'::uuid; begin
      update public.execution_budget set reserved=200 where id=true;
      begin perform public.reserve_execution(uid,'guard-test'); raise exception 'MISSING_BUDGET_GUARD'; exception when others then if sqlerrm <> 'EXECUTION_BUDGET_EXHAUSTED' then raise; end if; end;
      update public.execution_budget set reserved=0 where id=true;
      perform public.reserve_execution(uid,'guard-test');
      begin perform public.reserve_execution(uid,'guard-test'); raise exception 'MISSING_COOLDOWN'; exception when others then if sqlerrm <> 'PLEASE_WAIT' then raise; end if; end;
      update public.execution_jobs set status='completed',created_at=now()-interval '1 hour' where user_id=uid;
      insert into public.execution_jobs(user_id,status,created_at,code_hash) select uid,'completed',now()-interval '1 hour','guard-test' from generate_series(1,19);
      begin perform public.reserve_execution(uid,'guard-test'); raise exception 'MISSING_DAILY_GUARD'; exception when others then if sqlerrm <> 'DAILY_LIMIT_REACHED' then raise; end if; end;
      insert into public.execution_jobs(status,code_hash) select 'running','guard-test' from generate_series(1,4);
      begin perform public.reserve_execution('${second.id}'::uuid,'guard-test'); raise exception 'MISSING_CONCURRENCY_GUARD'; exception when others then if sqlerrm <> 'RUNNERS_BUSY' then raise; end if; end;
    end $$;
    rollback;`;
  const guard=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query:guardQuery}),signal:AbortSignal.timeout(15000)});
  assert.ok(guard.ok,'Execution quota database checks failed');
  console.log('PASS atomic total allowance, cooldown, daily cap and concurrency guards (rolled back)');
  assert.equal((await call('/api/execute',first,'POST',{code:'x'},'https://example.com')).status,403);
  assert.equal((await call('/api/execute',first,'POST',{code:'x'.repeat(50001)})).status,400);
  const launch=await call('/api/execute',first,'POST',{code:'function containsDuplicate(nums:number[]):boolean { return new Set(nums).size !== nums.length; }'});
  assert.equal(launch.status,202,`Launch failed: ${launch.data.error}`);jobs.push(launch.data.id);
  assert.equal((await call(`/api/execute?id=${launch.data.id}`,second)).status,404);
  const cross=await second.client.from('execution_jobs').select('id').eq('id',launch.data.id);assert.ifError(cross.error);assert.equal(cross.data.length,0);
  assert.equal((await call('/api/execute',first,'POST',{code:'function containsDuplicate(){return false;}'})).status,429);
  const direct=await first.client.rpc('reserve_execution',{p_user_id:first.id,p_code_hash:'test'});assert.ok(direct.error);
  console.log('PASS auth, origin, payload validation, ownership/RLS and duplicate-run limits');
  const deadline=Date.now()+270000;let complete;
  while(Date.now()<deadline) {
    const result=await call(`/api/execute?id=${launch.data.id}`,first);
    assert.equal(result.status,200);
    if(result.data.status==='completed') {complete=result.data;break;}
    assert.notEqual(result.data.status,'failed','Fargate task failed');
    await new Promise(resolve=>setTimeout(resolve,5000));
  }
  assert.ok(complete,'Task did not finish');assert.equal(complete.result.passed,true);assert.equal(complete.result.checks.length,8);
  console.log('PASS real Fargate TypeScript execution: all 8 tests passed and results persisted');
  const {data:job}=await admin.from('execution_jobs').select('task_arn').eq('id',launch.data.id).single();
  let stopped;
  const stopDeadline=Date.now()+120000;
  while(Date.now()<stopDeadline) {
    const tasks=await ecs.send(new DescribeTasksCommand({cluster:process.env.AWS_ECS_CLUSTER,tasks:[job.task_arn]}));
    if(tasks.tasks[0].lastStatus==='STOPPED') {stopped=tasks.tasks[0];break;}
    await new Promise(resolve=>setTimeout(resolve,5000));
  }
  assert.ok(stopped,'Task did not stop after finishing');
  assert.equal(stopped.containers[0].exitCode,0);
  console.log('PASS task exited successfully and stopped');
}
main().catch(e=>{console.error('FAIL:',e.message);process.exitCode=1;}).finally(async()=>{
  for(const id of jobs) {
    const {data:job}=await admin.from('execution_jobs').select('task_arn').eq('id',id).maybeSingle();
    if(job?.task_arn) await ecs.send(new StopTaskCommand({cluster:process.env.AWS_ECS_CLUSTER,task:job.task_arn,reason:'Integration test cleanup'})).catch(()=>{});
  }
  for(const id of users) {const {error}=await admin.auth.admin.deleteUser(id);if(error)process.exitCode=1;}
  console.log('Temporary accounts removed; execution reservations remain counted.');
});
