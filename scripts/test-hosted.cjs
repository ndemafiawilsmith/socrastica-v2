// Verify the remote app over an encrypted SSH tunnel, or publicly with --public.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {randomUUID}=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const {createServerClient}=require('@supabase/ssr');
require('@next/env').loadEnvConfig(process.cwd());
const host=JSON.parse(fs.readFileSync('infra/aws/hosting-resources.json','utf8'));
const origin='https://socrastica.com',base=process.argv.includes('--public')?origin:'http://127.0.0.1:3002';
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const jar=new Map();let userId;
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
 for(const route of ['/','/login','/signup','/forgot-password','/reset-password','/exercises']){
  const page=await call(route);assert.equal(page.status,200,route);
  const asset=page.text.match(/href="([^\"]+\.css[^\"]*)"/);assert.ok(asset,route+' stylesheet');
  assert.equal((await fetch(base+asset[1].replaceAll('&amp;','&'))).status,200);
 }
 assert.equal((await call('/studio')).status,307);
 assert.equal((await call('/api/studio')).status,401);
 const callback=await call('/auth/callback?next=https://example.com');
 assert.equal(callback.status,307);assert.equal(callback.headers.get('location'),origin+'/login?error=confirmation');
 console.log('PASS hosted pages, stylesheets, protected studio, and API authentication');
 const email=`socrastica-hosted-${randomUUID()}@example.com`,password=`${randomUUID()}Aa1!`;
 const created=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(created.error);userId=created.data.user.id;
 const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,value))}});
 assert.ifError((await client.auth.signInWithPassword({email,password})).error);
 const session=await call('/api/studio');assert.equal(session.status,200);
 const code='function containsDuplicate(nums: number[]): boolean { const seen = new Set<number>(); for (const value of nums) { if (seen.has(value)) return true; seen.add(value); } return false; }';
 const saved=await call('/api/studio','PATCH',{blueprint:session.data.blueprint,code,revision:session.data.blueprint_revision});assert.equal(saved.status,200,saved.data.error);
 assert.equal((await call('/api/studio')).data.code,code);
 assert.equal((await call('/api/studio','PATCH',{blueprint:session.data.blueprint,code,revision:saved.data.blueprint_revision},'https://example.com')).status,403);
 console.log('PASS hosted sign-in, persistence, and origin guard');
 const run=await call('/api/studio/run','POST',{revision:saved.data.blueprint_revision});
 assert.equal(run.status,200,run.data.error);assert.equal(run.data.passed,true);assert.equal(run.data.total,40);
 console.log('PASS hosted in-process sandbox run on 40 inputs');
 assert.ifError((await client.auth.signOut()).error);
 console.log('PASS sign-out; temporary test account will be removed.');
}
main().catch(error=>{console.error('FAIL',error.message);process.exitCode=1}).finally(async()=>{
 if(userId){const removed=await admin.auth.admin.deleteUser(userId);if(removed.error){console.error('Temporary account cleanup failed');process.exitCode=1}}
 tunnel?.kill();
});
