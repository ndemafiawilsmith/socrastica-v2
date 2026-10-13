const assert=require('node:assert/strict'),fs=require('node:fs'),{randomUUID}=require('node:crypto');
const {createClient}=require('@supabase/supabase-js'),{createServerClient}=require('@supabase/ssr');
require('@next/env').loadEnvConfig(process.cwd());
const base=process.env.STUDIO_TEST_URL||'http://localhost:3000';
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),users=[];
async function account(){
 const email=`socrastica-teaching-${randomUUID()}@example.com`,password=`${randomUUID()}Aa1!`;
 const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(error);users.push(data.user.id);
 const jar=new Map(),client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,value))}});
 assert.ifError((await client.auth.signInWithPassword({email,password})).error);
 return {id:data.user.id,email,password,client,cookie:()=>[...jar].map(([key,value])=>`${key}=${value}`).join('; ')};
}
async function call(route,user,method='GET',body){
 const response=await fetch(base+route,{method,headers:{Cookie:user?.cookie()||'',Origin:base,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});return {status:response.status,data:await response.json()};
}
async function main(){
 assert.equal((await call('/api/classrooms')).status,401);
 const teacher=await account(),student=await account(),outsider=await account();
 for(const user of [teacher,student,outsider])assert.equal((await call('/api/studio',user)).status,200);
 let document=(await call('/api/studio',student)).data;
 assert.equal((await call('/api/studio/history',student,'POST',{kind:'reflection',revision:0,text:'Private before joining'})).status,200);
 const created=await call('/api/classrooms',teacher,'POST',{name:'Architecture lab'});assert.equal(created.status,201,created.data.error);const classroom=created.data;
 assert.equal((await call(`/api/classrooms/${classroom.id}`,outsider)).status,404);
 assert.equal((await call(`/api/classrooms/${classroom.id}`,student,'PATCH',{kind:'settings',settings:{hint_depth:0,allow_code:false,require_prediction:true}})).status,404);
 const privateClasses=await student.client.from('classrooms').select('*');assert.ifError(privateClasses.error);assert.equal(privateClasses.data.length,0);
 assert.equal((await call('/api/classrooms/join',student,'POST',{code:classroom.join_code,name:'Alex'})).status,200);
 document=(await call('/api/studio',student)).data;assert.equal(document.classroom.id,classroom.id);assert.equal(document.classroom.join_code,undefined);
 const graph=JSON.parse(fs.readFileSync('scripts/fixtures/blueprint.json','utf8'));
 const saved=await call('/api/studio',student,'PATCH',{blueprint:graph,code:'',revision:0});assert.equal(saved.status,200,saved.data.error);document=saved.data;
 let review=(await call(`/api/classrooms/${classroom.id}?student=${student.id}`,teacher)).data;
 assert.ok(review.events.some(event=>event.kind==='blueprint_saved'));assert.ok(!review.events.some(event=>event.detail.text==='Private before joining'));
 assert.equal((await call(`/api/classrooms/${classroom.id}?student=${outsider.id}`,teacher)).status,404);
 const isolated=await outsider.client.from('studio_events').select('*').eq('user_id',student.id);assert.ifError(isolated.error);assert.equal(isolated.data.length,0);
 const denied=await student.client.from('studio_events').insert({user_id:student.id,kind:'prediction',revision:document.blueprint_revision,detail:{correct:true}});assert.ok(denied.error);
 const deniedRpc=await student.client.rpc('record_studio_event',{p_user_id:student.id,p_kind:'reflection',p_detail:{text:'forged'},p_blueprint:null,p_expected_revision:null});assert.ok(deniedRpc.error);
 console.log('PASS private classes, explicit sharing, cross-account isolation, RLS and privileged RPC denial');
 const rev=document.blueprint_revision;
 assert.equal((await call('/api/studio/history',student,'POST',{kind:'reflection',revision:0,text:'Stale'})).status,409);
 assert.equal((await call('/api/studio/history',student,'POST',{kind:'prediction',revision:rev,input:[1,2,3,2],step:2,answer:'check',correct:true})).status,400);
 let wrong=await call('/api/studio/history',student,'POST',{kind:'prediction',revision:rev,input:[1,2,3,2],step:2,answer:'no'});assert.equal(wrong.status,200,wrong.data.error);assert.equal(wrong.data.detail.correct,false);
 let right=await call('/api/studio/history',student,'POST',{kind:'prediction',revision:rev,input:[1,2,3,2],step:2,answer:'check'});assert.equal(right.status,200,right.data.error);assert.equal(right.data.detail.correct,true);
 const budgetBefore=(await admin.from('ai_budget').select('reserved_microdollars').single()).data.reserved_microdollars;
 assert.equal((await call(`/api/classrooms/${classroom.id}`,teacher,'PATCH',{kind:'settings',settings:{hint_depth:1,require_prediction:true,allow_code:false}})).status,200);
 assert.equal((await call('/api/studio/generate',student,'POST',{revision:rev})).status,403);
 assert.equal((await admin.from('ai_budget').select('reserved_microdollars').single()).data.reserved_microdollars,budgetBefore);
 const changed=structuredClone(graph);changed.nodes.find(node=>node.id==='check').id='decision';changed.edges.forEach(edge=>{if(edge.source==='check')edge.source='decision';if(edge.target==='check')edge.target='decision';});
 document=(await call('/api/studio',student,'PATCH',{blueprint:changed,code:'',revision:rev})).data;
 assert.equal((await call(`/api/classrooms/${classroom.id}`,teacher,'PATCH',{kind:'settings',settings:{hint_depth:2,require_prediction:true,allow_code:true}})).status,200);
 assert.equal((await call('/api/studio/generate',student,'POST',{revision:document.blueprint_revision})).status,422,'Correct prediction must belong to current graph');
 assert.equal((await admin.from('ai_budget').select('reserved_microdollars').single()).data.reserved_microdollars,budgetBefore);
 const raced=await admin.rpc('record_studio_event',{p_user_id:student.id,p_kind:'reflection',p_detail:{text:'Stale snapshot'},p_blueprint:null,p_expected_revision:rev});assert.ok(raced.error?.message.includes('REVISION_CONFLICT'));
 assert.equal((await call('/api/studio/history',student,'POST',{kind:'simulation',revision:document.blueprint_revision,input:[1,2,3,2]})).data.detail.passed,true);
 assert.equal((await call('/api/studio/history',student,'POST',{kind:'reflection',revision:document.blueprint_revision,text:'I keep earlier numbers in memory, check before adding, and continue when the number is new.'})).status,200);
 assert.equal((await call(`/api/classrooms/${classroom.id}`,teacher,'PATCH',{kind:'feedback',student:student.id,note:'Good explanation. Try the empty input next.',rubric:{memory:'understood',branching:'developing',edge_cases:'unreviewed'}})).status,200);
 assert.equal((await call('/api/studio',student)).data.feedback.rubric.memory,'understood');
 console.log('PASS atomic revisions, server-checked predictions, graph-specific instructor policy, feedback, and zero AI spending');
 assert.equal((await call('/api/classrooms/join',student,'DELETE')).status,200);
 assert.equal((await call('/api/studio',student)).data.classroom,null);
 assert.equal((await call('/api/studio/history',student,'POST',{kind:'reflection',revision:document.blueprint_revision,text:'Private after leaving'})).status,200);
 review=(await call(`/api/classrooms/${classroom.id}?student=${student.id}`,teacher)).data;assert.equal(review.session,null);assert.ok(!review.events.some(event=>event.detail.text==='Private after leaving'));assert.ok(review.events.some(event=>event.kind==='joined'&&event.blueprint));
 console.log('PASS returning to private practice preserves shared evidence without exposing future work');
 if(process.argv.includes('--keep')){
  assert.equal((await call('/api/classrooms/join',student,'POST',{code:classroom.join_code,name:'Alex'})).status,200);
  fs.mkdirSync('infra/aws/private',{recursive:true});fs.writeFileSync('infra/aws/private/teaching-test-users.json',JSON.stringify({teacher:{id:teacher.id,email:teacher.email,password:teacher.password},student:{id:student.id,email:student.email,password:student.password},classroom}));
  users.splice(users.indexOf(teacher.id),1);users.splice(users.indexOf(student.id),1);console.log('Temporary accounts retained in ignored file for browser checks.');
 }
}
main().catch(error=>{console.error('FAIL',error.message);process.exitCode=1}).finally(async()=>{for(const id of users){const removed=await admin.auth.admin.deleteUser(id);if(removed.error)process.exitCode=1;}});
