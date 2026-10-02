const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const {createServerClient}=require('@supabase/ssr');
require('@next/env').loadEnvConfig(process.cwd());
const base='http://localhost:3000';
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
let userId;
const jar=new Map();
async function call(path,method='GET',body) {
  const res=await fetch(base+path,{method,headers:{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; '),Origin:base,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(50000)});
  return {status:res.status,data:await res.json()};
}
async function main() {
  const email=`socrastica-reasoning-${randomUUID()}@example.com`,password=`${randomUUID()}Aa1!`;
  const account=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(account.error);userId=account.data.user.id;
  const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,value))}});
  assert.ifError((await client.auth.signInWithPassword({email,password})).error);
  let loaded=await call('/api/progress');assert.equal(loaded.status,200);const code=loaded.data.code;
  assert.equal((await call('/api/progress','PATCH',{code,step:3,unlocked:3})).status,200);
  loaded=await call('/api/progress');assert.equal(loaded.data.unlocked,1);assert.equal(loaded.data.step,1);
  console.log('PASS incomplete reasoning cannot unlock map/build through progress updates');
  const incomplete=await call('/api/mentor','POST',{text:'I would remember numbers using a set, but I have not figured out the checks or return values yet.'});
  assert.equal(incomplete.status,200,incomplete.data.error);assert.equal(incomplete.data.reasoning_ready,false);assert.equal(incomplete.data.reasoning_graph,null);assert.equal(incomplete.data.step,1);
  console.log('PASS incomplete reasoning receives guidance and stays in Reason');
  await new Promise(r=>setTimeout(r,11000));
  const complete=await call('/api/mentor','POST',{text:'I loop through the numbers with an initially empty set. Before adding each number, I check whether it is already in the set. If so I return true. Otherwise I add it and continue. If the loop finishes without a repeat I return false, including when the array is empty.'});
  assert.equal(complete.status,200,complete.data.error);assert.equal(complete.data.reasoning_ready,true);assert.equal(complete.data.step,2);assert.equal(complete.data.unlocked,2);assert.ok(complete.data.reasoning_graph.nodes.length>=3);
  assert.ok(!complete.data.messages.at(-1).content.includes('?'),'Ready response should not keep quizzing');
  console.log('PASS complete reasoning produces a personalized graph and automatically advances to Map');
  loaded=await call('/api/progress');assert.equal(loaded.data.step,2);assert.deepEqual(loaded.data.reasoning_graph,complete.data.reasoning_graph);
  // Simulate a stale autosave that was sent before the mentor response.
  await call('/api/progress','PATCH',{code,step:1,unlocked:1});
  loaded=await call('/api/progress');assert.equal(loaded.data.step,2);assert.equal(loaded.data.unlocked,2);
  await call('/api/progress','PATCH',{code,step:3,unlocked:3});
  loaded=await call('/api/progress');assert.equal(loaded.data.step,3);
  console.log('PASS map persists, stale saves cannot undo advancement, and Build can be opened');
}
main().catch(e=>{console.error('FAIL:',e.message);process.exitCode=1;}).finally(async()=>{
  if(userId){const {error}=await admin.auth.admin.deleteUser(userId);if(error)process.exitCode=1;}
  console.log('Temporary account removed. Two live AI attempts remain budgeted.');
});
