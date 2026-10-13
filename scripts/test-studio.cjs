const assert=require('node:assert/strict'),fs=require('node:fs'),{randomUUID}=require('node:crypto');
const {createClient}=require('@supabase/supabase-js'),{createServerClient}=require('@supabase/ssr');
require('@next/env').loadEnvConfig(process.cwd());
const base=process.env.STUDIO_TEST_URL||'http://localhost:3000';
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const users=[];
async function account(){
 const email=`socrastica-canvas-${randomUUID()}@example.com`,password=`${randomUUID()}Aa1!`;
 const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(error);users.push(data.user.id);
 const jar=new Map(),client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,value))}});
 assert.ifError((await client.auth.signInWithPassword({email,password})).error);
 return {id:data.user.id,email,password,client,cookie:()=>[...jar].map(([key,value])=>`${key}=${value}`).join('; ')};
}
async function call(route,user,method='GET',body,origin=base){
 const response=await fetch(base+route,{method,headers:{Cookie:user?.cookie()||'',Origin:origin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(60000)});return {status:response.status,data:await response.json()};
}
async function main(){
 assert.equal((await call('/api/studio')).status,401);const first=await account(),second=await account();
 let document=(await call('/api/studio',first)).data;assert.equal(document.blueprint.nodes[0].op,'start');
 assert.equal((await call('/api/studio',second)).status,200);
 const invalid={...document.blueprint,edges:[{id:'bad',source:'input',target:'missing',port:'next'}]};
 assert.equal((await call('/api/studio',first,'PATCH',{blueprint:invalid,code:'',revision:0})).status,400);
 assert.equal((await call('/api/studio',first,'PATCH',{blueprint:document.blueprint,code:'',revision:0},'https://example.com')).status,403);
 const budgetBefore=(await admin.from('ai_budget').select('reserved_microdollars').single()).data.reserved_microdollars;
 assert.equal((await call('/api/studio/generate',first,'POST',{revision:0})).status,422);
 const budgetAfter=(await admin.from('ai_budget').select('reserved_microdollars').single()).data.reserved_microdollars;assert.equal(budgetBefore,budgetAfter);
 console.log('PASS auth/origin/payload guards and incomplete blueprint cannot spend the AI allowance');
 const graph=JSON.parse(fs.readFileSync('scripts/fixtures/blueprint.json','utf8'));
 const saved=await call('/api/studio',first,'PATCH',{blueprint:graph,code:'// saved test draft',revision:0});assert.equal(saved.status,200);document=saved.data;
 assert.equal((await call('/api/studio',first,'PATCH',{blueprint:graph,code:'// stale overwrite',revision:0})).status,409);
 assert.equal((await call('/api/studio',first)).data.code,'// saved test draft');
 const other=(await call('/api/studio',second)).data;assert.equal(other.blueprint.nodes.length,1);assert.notEqual(other.code,'// saved test draft');
 const rls=await second.client.from('learning_sessions').select('blueprint').eq('user_id',first.id);assert.ifError(rls.error);assert.equal(rls.data.length,0);
 assert.equal((await call('/api/progress',first,'PATCH',{code:'// legacy stale overwrite',step:1,unlocked:1})).status,503);
 console.log('PASS saved layout/edges, revision conflicts, account isolation, RLS, and legacy overwrite protection');
 if(process.argv.includes('--live')){
  const direct=await call('/api/studio/direct',first,'POST',{revision:document.blueprint_revision,text:'Use an initially empty seen set. For each number, first check whether it is in the set. If yes, return true. If no, add it to the set and continue to the next number. When there are no numbers left, return false, including an empty list.'});assert.equal(direct.status,200,direct.data.error);assert.equal(direct.data.baseRevision,document.blueprint_revision);assert.deepEqual((await call('/api/studio',first)).data.blueprint,document.blueprint,'AI proposals must not replace the canvas');document=(await call('/api/studio',first,'PATCH',{blueprint:direct.data.blueprint,code:document.code,revision:document.blueprint_revision})).data;
  console.log('PASS live AI direction produces a reviewable proposal that is saved only after approval');
  await new Promise(resolve=>setTimeout(resolve,11000));
  const response=await fetch(base+'/api/studio/generate',{method:'POST',headers:{Cookie:first.cookie(),Origin:base,'Content-Type':'application/json'},body:JSON.stringify({revision:document.blueprint_revision}),signal:AbortSignal.timeout(60000)});
  assert.equal(response.status,200);const events=(await response.text()).trim().split('\n').map(line=>JSON.parse(line));assert.ok(events.some(event=>event.type==='code'&&event.code.length>0),'Code must stream before completion');assert.ok(!events.some(event=>event.type==='error'),events.find(event=>event.type==='error')?.message);
  const done=events.find(event=>event.type==='done');assert.ok(done,'Verified code completion');assert.equal(done.checked,40);document=done.document;assert.ok(document.draft_hash);assert.ok(document.code.includes('containsDuplicate'));
  assert.equal((await call('/api/studio',first)).data.code,document.code);
  const moved=structuredClone(document.blueprint);moved.nodes[0].x+=30;
  document=(await call('/api/studio',first,'PATCH',{blueprint:moved,code:document.code,revision:document.blueprint_revision})).data;assert.ok(document.draft_hash,'Layout-only edits preserve verification');
  console.log('PASS live code streaming, isolated 40-input verification, persisted draft, and layout-only verification preservation');
 }
 if(process.argv.includes('--keep')){
  fs.mkdirSync('infra/aws/private',{recursive:true});fs.writeFileSync('infra/aws/private/studio-test-user.json',JSON.stringify({id:first.id,email:first.email,password:first.password}),{mode:0o600});users.splice(users.indexOf(first.id),1);console.log('Temporary UI-test account retained in ignored local file for browser checks.');
 }
}
main().catch(error=>{console.error('FAIL',error.message);process.exitCode=1}).finally(async()=>{for(const id of users){const removed=await admin.auth.admin.deleteUser(id);if(removed.error)process.exitCode=1;}});
