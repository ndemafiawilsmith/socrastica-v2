const assert=require('node:assert/strict'),fs=require('node:fs'),{randomUUID}=require('node:crypto'),{load}=require('./load-ts.cjs');
const exercises=load('src/lib/exercises.ts'),runner=load('src/lib/exercise-runner.ts'),destinations=load('src/lib/auth-destination.ts');
const expected={'naira-to-dollar':3,'dollar-to-naira':4500,'discount-price':4000,'tip-total':2200,'celsius-fahrenheit':77,'fahrenheit-celsius':25,'minutes-seconds':150,'rectangle-area':12,'rectangle-perimeter':14,'even-number':false,'positive-number':false,'sum-list':10,'average-list':20,'count-even':3,'largest-number':12,'smallest-number':3,'sort-list':[2,5,10],'reverse-text':'olleh','palindrome':true,'text-length':6};
async function main(){
 assert.equal(new Set(exercises.exercises.map(e=>e.id)).size,20);
 for(const exercise of exercises.exercises){assert.deepEqual(exercises.runPlan(exercise.solution,exercise.sample).result,expected[exercise.id],exercise.id);assert.ok(exercises.checkPlan(exercise,exercise.solution).every(test=>test.passed));const checked=await runner.testExerciseCode(exercises.codeForPlan(exercise.solution),exercise,exercise.solution);assert.ok(checked.every(test=>test.passed),exercise.id);}
 const currency=exercises.findExercise('naira-to-dollar');assert.equal(exercises.runPlan(currency.solution,2250).result,1.5);assert.equal(exercises.runPlan(currency.solution,1).result,0);
 assert.throws(()=>exercises.validateInput(currency,-1));assert.throws(()=>exercises.validateInput(exercises.findExercise('rectangle-area'),[1]));assert.throws(()=>exercises.validateInput(exercises.findExercise('count-even'),[1.5]));
 assert.match(exercises.runPlan([{op:'divide',amount:0}],10).error,/zero/);assert.match(exercises.runPlan([{op:'sum'}],10).error,/list/);
 assert.ok(exercises.checkPlan(currency,[{op:'multiply',amount:1500}]).some(test=>!test.passed));
 assert.ok(!exercises.planSchema.safeParse(Array.from({length:13},()=>({op:'add',amount:1}))).success);assert.ok(!exercises.planSchema.safeParse([{op:'eval',amount:1}]).success);
 assert.ok((await runner.testExerciseCode('function solve(){while(true){}}',currency,currency.solution)).every(test=>!test.passed&&test.actual===null),'Infinite loops stop at the time limit');assert.ok((await runner.testExerciseCode('function solve(){return process.env.SECRET}',currency,currency.solution)).every(test=>!test.passed&&test.actual===null),'No host process access');await assert.rejects(runner.testExerciseCode('import fs from "fs"; function solve(){return 0}',currency,currency.solution));
 assert.equal(destinations.authDestination('//evil.example'),'/exercises');assert.equal(destinations.authDestination('/learn/naira-to-dollar'),'/learn/naira-to-dollar');assert.equal(destinations.authDestination('/learn/unknown'),'/exercises');
 console.log('PASS 20 exercise answers, edge cases, plan interpretation, generated code, isolation, limits and safe auth destinations');
 if(process.argv.includes('--integration'))await integration(currency);
}
async function integration(currency){
 require('@next/env').loadEnvConfig(process.cwd());const {createClient}=require('@supabase/supabase-js'),{createServerClient}=require('@supabase/ssr');const base='http://localhost:3000',admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),users=[];
 async function account(){const email=`socrastica-exercise-${randomUUID()}@example.com`,password=`${randomUUID()}Aa1!`,created=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(created.error);users.push(created.data.user.id);const jar=new Map(),client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,value))}});assert.ifError((await client.auth.signInWithPassword({email,password})).error);return {id:created.data.user.id,email,password,client,cookie:()=>[...jar].map(([name,value])=>`${name}=${value}`).join('; ')};}
 async function call(id,user,method='GET',body,origin=base){const response=await fetch(`${base}/api/exercises/${id}`,{method,headers:{Cookie:user?.cookie()||'',Origin:origin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(60000)});return {status:response.status,data:await response.json()};}
 try{
  assert.equal((await call(currency.id)).status,401);const student=await account(),other=await account();assert.equal((await call('unknown',student)).status,404);
  let document=(await call(currency.id,student)).data;assert.equal(document.revision,0);assert.deepEqual(document.plan,[]);
  const budgetBefore=(await admin.from('ai_budget').select('reserved_microdollars').single()).data.reserved_microdollars;
  assert.equal((await call(currency.id,student,'POST',{action:'draft',revision:0})).status,422);
  assert.equal((await admin.from('ai_budget').select('reserved_microdollars').single()).data.reserved_microdollars,budgetBefore);
  const body={revision:0,plan:currency.solution,code:exercises.codeForPlan(currency.solution),reflection:'I divide by 1500 because each dollar represents 1500 naira.'};
  assert.equal((await call(currency.id,student,'PATCH',body,'https://evil.example')).status,403);
  const saved=await call(currency.id,student,'PATCH',body);assert.equal(saved.status,200,saved.data.error);document=saved.data;assert.equal(document.verified,false);
  assert.equal((await call(currency.id,student,'PATCH',body)).status,409);
  assert.deepEqual((await call(currency.id,other)).data.plan,[]);
  const hidden=await other.client.from('exercise_sessions').select('*').eq('user_id',student.id);assert.ifError(hidden.error);assert.equal(hidden.data.length,0);
  const write=await student.client.from('exercise_sessions').update({verified:true}).eq('exercise_id',currency.id);assert.ok(write.error);
  assert.ok((await student.client.rpc('reserve_exercise_run',{p_user_id:student.id})).error);
  const run=await call(currency.id,student,'POST',{action:'run',revision:document.revision});assert.equal(run.status,200,run.data.error);assert.ok(run.data.results.every(test=>test.passed));document=run.data.document;assert.equal(document.verified,true);
  assert.equal((await call(currency.id,student,'POST',{action:'run',revision:document.revision})).status,429);
  assert.equal((await call('average-list',student)).data.revision,0);assert.equal((await call(currency.id,student)).data.reflection,body.reflection);
  if(process.argv.includes('--live')){const draft=await call(currency.id,student,'POST',{action:'draft',revision:document.revision});assert.equal(draft.status,200,draft.data.error);assert.equal(draft.data.document.verified,true);assert.ok(draft.data.results.every(test=>test.passed));console.log('PASS one budgeted live currency draft verified against the saved plan');}
  console.log('PASS exercise persistence, per-exercise separation, RLS, stale saves, quota, code verification and AI spending guard');
  if(process.argv.includes('--keep')){fs.mkdirSync('infra/aws/private',{recursive:true});fs.writeFileSync('infra/aws/private/exercise-test-user.json',JSON.stringify({id:student.id,email:student.email,password:student.password}));users.splice(users.indexOf(student.id),1);console.log('Disposable exercise account retained for UI checks.');}
 }finally{for(const id of users){const removed=await admin.auth.admin.deleteUser(id);assert.ifError(removed.error);}}
}
main().catch(error=>{console.error('FAIL',error.message);process.exitCode=1});
