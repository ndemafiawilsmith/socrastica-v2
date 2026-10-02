import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { serverClient,adminClient } from '@/lib/supabase/server';
import { sameOrigin,readBody } from '@/lib/http';
import { launchExecution,inspectExecution,stopExecution } from '@/lib/execution';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request:NextRequest) {
  if(!sameOrigin(request)) return response({error:'Invalid request origin.'},403);
  let id:string|undefined; let arn:string|undefined;
  try {
    const db=await serverClient(); const {data:{user}}=await db.auth.getUser();
    if(!user) return response({error:'Sign in to execute code.'},401);
    let parsed; try {parsed=z.object({code:z.string().min(1).max(40000)}).strict().safeParse(await readBody(request,60000));} catch {return response({error:'Invalid code submission.'},400);}
    if(!parsed.success||Buffer.byteLength(parsed.data.code)>50000) return response({error:'Code must be under 50 KB.'},400);
    const admin=adminClient();
    const reservation=await admin.rpc('reserve_execution',{p_user_id:user.id,p_code_hash:createHash('sha256').update(parsed.data.code).digest('hex')});
    if(reservation.error) {
      const message=reservation.error.message;
      if(message.includes('EXECUTION_BUDGET_EXHAUSTED')) return response({error:'The shared execution testing allowance has been reached.'},429);
      if(/PLEASE_WAIT|DAILY_LIMIT_REACHED|RUNNERS_BUSY/.test(message)) return response({error:'Please wait before trying again. Runs are limited to 20 per person per day.'},429);
      return response({error:'Execution storage is unavailable.'},503);
    }
    id=reservation.data as string;
    arn=await launchExecution(id,parsed.data.code);
    const saved=await admin.from('execution_jobs').update({status:'running',task_arn:arn}).eq('id',id);
    if(saved.error) throw new Error('SAVE_FAILED');
    return response({id,status:'running'},202);
  } catch {
    if(arn) await stopExecution(arn).catch(()=>{});
    if(id) await adminClient().from('execution_jobs').update({status:'failed'}).eq('id',id);
    return response({error:'The execution runner is unavailable. Please retry shortly.'},503);
  }
}
export async function GET(request:NextRequest) {
  try {
    const db=await serverClient(); const {data:{user}}=await db.auth.getUser();
    if(!user) return response({error:'Sign in to see results.'},401);
    const id=request.nextUrl.searchParams.get('id');
    if(!id||!z.string().uuid().safeParse(id).success) return response({error:'Invalid execution ID.'},400);
    const admin=adminClient();
    const {data:job,error}=await admin.from('execution_jobs').select('id,status,task_arn,created_at,result').eq('id',id).eq('user_id',user.id).maybeSingle();
    if(error) return response({error:'Execution storage is unavailable.'},503);
    if(!job) return response({error:'Execution not found.'},404);
    if(job.status==='completed'||job.status==='failed') return response({id,status:job.status,result:job.result});
    if(!job.task_arn) return response({id,status:'queued'});
    if(Date.now()-new Date(job.created_at).getTime()>240000) {
      await stopExecution(job.task_arn);
      const updated=await admin.from('execution_jobs').update({status:'failed'}).eq('id',id);
      if(updated.error) throw new Error('SAVE_FAILED');
      return response({id,status:'failed'});
    }
    const result=await inspectExecution(id,job.task_arn);
    if(result.status!=='running') {
      const updated=await admin.from('execution_jobs').update(result).eq('id',id);
      if(updated.error) throw new Error('SAVE_FAILED');
    }
    return response({id,...result});
  } catch {return response({error:'Unable to retrieve execution results.'},503);}
}
