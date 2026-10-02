const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const { createServerClient } = require('@supabase/ssr');
require('@next/env').loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const base = process.env.NEXT_PUBLIC_APP_URL;
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession:false, autoRefreshToken:false } });
const created = [];
async function account() {
  const email = `socrastica-test-${randomUUID()}@example.com`;
  const password = `${randomUUID()}Aa1!`;
  const {data, error} = await admin.auth.admin.createUser({email,password,email_confirm:true});
  assert.ifError(error); assert.ok(data.user); created.push(data.user.id);
  const jar = new Map();
  const client = createServerClient(url,key,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:items=>items.forEach(({name,value})=>jar.set(name,value))}});
  const signed = await client.auth.signInWithPassword({email,password}); assert.ifError(signed.error);
  return { id:data.user.id, client, cookie:()=>[...jar].map(([k,v])=>`${k}=${v}`).join('; ') };
}
async function call(path, user, method='GET', body, origin=base) {
  const response = await fetch(new URL(path,base), {method,headers:{Cookie:user?user.cookie():'',Origin:origin,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(55000)});
  let data; try{data=await response.json();}catch{data={};}
  return {status:response.status,data};
}
async function management(query) {
  const ref = new URL(url).hostname.split('.')[0];
  const result = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {method:'POST',headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(15000)});
  assert.ok(result.ok,'Management test query failed');
}
async function main() {
  assert.equal((await call('/api/progress')).status,401); console.log('PASS unauthenticated progress is blocked');
  const first = await account(); const second = await account();
  for (const user of [first,second]) { const result = await call('/api/progress',user); assert.equal(result.status,200,'Authenticated session creation'); }
  console.log('PASS email/password sign-in and session creation');
  const payload = {step:1,unlocked:1,code:'// saved integration test draft'};
  assert.equal((await call('/api/progress',first,'PATCH',payload)).status,200);
  assert.equal((await call('/api/progress',first)).data.code,payload.code);
  console.log('PASS progress saves and reloads');
  assert.equal((await call('/api/progress',first,'PATCH',payload,'https://example.com')).status,403);
  assert.equal((await call('/api/progress',first,'PATCH',{...payload,step:3})).status,400);
  assert.equal((await call('/api/mentor',first,'POST',{text:'x'.repeat(2001)})).status,400);
  console.log('PASS origin, stage and message validation');
  const own = await first.client.from('learning_sessions').select('user_id'); assert.ifError(own.error); assert.equal(own.data.length,1); assert.equal(own.data[0].user_id,first.id);
  const other = await first.client.from('learning_sessions').select('id').eq('user_id',second.id); assert.ifError(other.error); assert.equal(other.data.length,0);
  const overwrite = await first.client.from('learning_sessions').update({code:'unauthorized'}).eq('user_id',second.id); assert.ok(overwrite.error);
  const reserve = await first.client.rpc('reserve_mentor_request',{p_user_id:first.id}); assert.ok(reserve.error);
  const budget = await first.client.from('ai_budget').select('*'); assert.ok(budget.error);
  console.log('PASS RLS account isolation, direct-write denial, budget protection');
  // Exercise budget exhaustion, throttling and daily limits in a transaction that rolls back.
  await management(`begin;
    do $$ declare uid uuid := '${second.id}'::uuid; begin
      update public.ai_budget set limit_microdollars=2000000, reserved_microdollars=2000000 where id=true;
      begin perform public.reserve_mentor_request(uid); raise exception 'MISSING_BUDGET_GUARD'; exception when others then if sqlerrm <> 'TEST_BUDGET_EXHAUSTED' then raise; end if; end;
      update public.ai_budget set reserved_microdollars=0 where id=true;
      perform public.reserve_mentor_request(uid);
      begin perform public.reserve_mentor_request(uid); raise exception 'MISSING_THROTTLE'; exception when others then if sqlerrm <> 'PLEASE_WAIT' then raise; end if; end;
      update public.ai_requests set status='completed',created_at=now()-interval '1 hour' where user_id=uid;
      insert into public.ai_requests(user_id,status,created_at) select uid,'completed',now()-interval '1 hour' from generate_series(1,19);
      begin perform public.reserve_mentor_request(uid); raise exception 'MISSING_DAILY_LIMIT'; exception when others then if sqlerrm <> 'DAILY_LIMIT_REACHED' then raise; end if; end;
    end $$;
    rollback;`);
  console.log('PASS atomic total budget, request throttle and daily cap (rolled back)');
  if(process.argv.includes('--live-ai')) {
    const ai = await call('/api/mentor',first,'POST',{text:'I would keep a set of numbers I have seen and check each number before adding it.'});
    assert.equal(ai.status,200,`Mentor request returned ${ai.status}`); assert.ok(ai.data.messages.length >= 3);
    const reloaded=await call('/api/progress',first); assert.equal(reloaded.data.messages.length,ai.data.messages.length);
    console.log('PASS one budgeted live mentor response and persisted conversation');
  }
  const logout=await first.client.auth.signOut(); assert.ifError(logout.error);
  assert.equal((await call('/api/progress',first)).status,401);
  console.log('PASS sign-out removes authenticated access');
}
main().catch(error=>{ console.error('FAIL:',error.code || error.message); process.exitCode=1; }).finally(async()=>{
  for(const id of created) { const {error}=await admin.auth.admin.deleteUser(id); if(error){console.error('Temporary account cleanup failed');process.exitCode=1;} }
  console.log('Temporary test accounts removed. AI reservations remain counted.');
});
