// Verify the remote app over an encrypted SSH tunnel before public DNS is ready.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {randomUUID}=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const {createServerClient}=require('@supabase/ssr');
const {ECSClient,StopTaskCommand}=require('@aws-sdk/client-ecs');
const {fromIni}=require('@aws-sdk/credential-providers');
require('@next/env').loadEnvConfig(process.cwd());
const host=JSON.parse(fs.readFileSync('infra/aws/hosting-resources.json','utf8'));
const origin='https://socrastica.com',base=process.argv.includes('--public')?origin:'http://127.0.0.1:3002';
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const jar=new Map();let userId;let jobId;
const tunnel=process.argv.includes('--public')?null:spawn('ssh',['-N','-L','127.0.0.1:3002:127.0.0.1:3000','-i',path.resolve(host.sshKeyPath),'-o','BatchMode=yes','-o','ExitOnForwardFailure=yes','-o','StrictHostKeyChecking=yes','-o',`UserKnownHostsFile=${path.resolve('infra/aws/private/known_hosts')}`,`ubuntu@${host.publicIp}`],{stdio:['ignore','ignore','pipe']});
tunnel?.stderr.on('data',chunk=>process.stderr.write(chunk));
async function call(route,method='GET',body,requestOrigin=origin){
 const response=await fetch(base+route,{method,headers:{Cookie:[...jar].map(([key,value])=>`${key}=${value}`).join('; '),Origin:requestOrigin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,redirect:'manual',signal:AbortSignal.timeout(50000)});
 const text=await response.text();let data;try{data=JSON.parse(text)}catch{data={}}
 return {status:response.status,data,text,headers:response.headers};
}
async function main(){
 let ready=false;
 for(let attempt=0;attempt<30;attempt++){try{if((await call('/login')).status===200){ready=true;break}}catch{}await new Promise(resolve=>setTimeout(resolve,1000));}
 assert.ok(ready,'SSH tunnel/app is not ready');
 for(const route of ['/','/login','/signup','/forgot-password','/reset-password']){
  const page=await call(route);assert.equal(page.status,200,route);
  const asset=page.text.match(/href="([^\"]+\.css[^\"]*)"/);assert.ok(asset,route+' stylesheet');
  assert.equal((await fetch(base+asset[1].replaceAll('&amp;','&'))).status,200);
 }
 assert.equal((await call('/studio')).status,307);
 assert.equal((await call('/api/progress')).status,401);
 const callback=await call('/auth/callback?next=https://example.com');
 assert.equal(callback.status,307);assert.equal(callback.headers.get('location'),origin+'/login?error=confirmation');
 console.log('PASS hosted pages, stylesheets, protected studio, and API authentication');
 const email=`socrastica-hosted-${randomUUID()}@example.com`,password=`${randomUUID()}Aa1!`;
 const created=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(created.error);userId=created.data.user.id;
 const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,value))}});
 assert.ifError((await client.auth.signInWithPassword({email,password})).error);
 const session=await call('/api/progress');assert.equal(session.status,200);
 const payload={code:'// hosted persistence test',step:1,unlocked:1};
 assert.equal((await call('/api/progress','PATCH',payload)).status,200);
 assert.equal((await call('/api/progress')).data.code,payload.code);
 assert.equal((await call('/api/progress','PATCH',payload,'https://example.com')).status,403);
 assert.equal((await call('/api/mentor','POST',{text:'x'.repeat(2001)})).status,400);
 console.log('PASS hosted sign-in, persistence, origin guard, and mentor validation');
 if(process.argv.includes('--ai')){
  const mentor=await call('/api/mentor','POST',{text:'I will use an initially empty set. I loop through the numbers: before adding a number, I check whether it is already in the set. If it is, return true immediately. Otherwise add it and continue. After finishing the loop, return false. An empty array also returns false.'});
  assert.equal(mentor.status,200,mentor.data.error);assert.equal(mentor.data.reasoning_ready,true);assert.equal(mentor.data.step,2);assert.ok(mentor.data.reasoning_graph);
  assert.equal((await call('/api/progress')).data.step,2);
  console.log('PASS hosted budget-approved AI mentoring, generated map, and saved automatic progression');
 }
 if(process.argv.includes('--execution')){
  const execution=await call('/api/execute','POST',{code:'function containsDuplicate(nums: number[]): boolean { const seen = new Set<number>(); for (const value of nums) { if (seen.has(value)) return true; seen.add(value); } return false; }'});
  assert.equal(execution.status,202,execution.data.error);jobId=execution.data.id;
  let completed;
  for(let attempt=0;attempt<70;attempt++){
   await new Promise(resolve=>setTimeout(resolve,3000));const result=await call('/api/execute?id='+jobId);assert.equal(result.status,200);
   if(result.data.status==='completed'){completed=result.data;break}
   assert.notEqual(result.data.status,'failed',result.data.error||'Runner failed');
  }
  assert.ok(completed,'Hosted execution timed out');assert.equal(completed.result.passed,true);assert.equal(completed.result.checks.length,8);
  console.log('PASS real hosted EC2 role → ECS Fargate execution, eight cases, and persisted result');
 }
 assert.ifError((await client.auth.signOut()).error);
 console.log('PASS sign-out; temporary test account will be removed.');
}
main().catch(error=>{console.error('FAIL',error.message);process.exitCode=1}).finally(async()=>{
 if(jobId){
  const {data:job}=await admin.from('execution_jobs').select('task_arn').eq('id',jobId).maybeSingle();
  if(job?.task_arn)await new ECSClient({region:'us-east-1',credentials:fromIni({profile:'socrastica'})}).send(new StopTaskCommand({cluster:process.env.AWS_ECS_CLUSTER,task:job.task_arn,reason:'Hosted integration cleanup'})).catch(()=>{});
 }
 if(userId){const removed=await admin.auth.admin.deleteUser(userId);if(removed.error){console.error('Temporary account cleanup failed');process.exitCode=1}}
 tunnel?.kill();
});
