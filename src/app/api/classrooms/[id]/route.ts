import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { serverClient,adminClient } from '@/lib/supabase/server';
import { classSettingsSchema,rubricSchema } from '@/lib/classroom';
import { sameOrigin,readBody } from '@/lib/http';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
async function owned(id:string){
  const db=await serverClient();const {data:{user}}=await db.auth.getUser();if(!user)return {error:'Sign in to review a class.',status:401} as const;
  if(!z.string().uuid().safeParse(id).success)return {error:'Class not found.',status:404} as const;
  const result=await db.from('classrooms').select('id,name,join_code,hint_depth,require_prediction,allow_code').eq('id',id).eq('owner_id',user.id).maybeSingle();
  if(result.error)return {error:'Class unavailable.',status:503} as const;
  if(!result.data)return {error:'Class not found.',status:404} as const;
  return {classroom:result.data} as const;
}
export async function GET(request:NextRequest,context:Context){
  const {id}=await context.params;const access=await owned(id);if('error' in access)return NextResponse.json({error:access.error},{status:access.status});const admin=adminClient();
  const student=request.nextUrl.searchParams.get('student');
  if(student){
    if(!z.string().uuid().safeParse(student).success)return NextResponse.json({error:'Student not found.'},{status:404});
    const member=await admin.from('classroom_members').select('display_name,user_id').eq('classroom_id',id).eq('user_id',student).maybeSingle();
    if(member.error)return NextResponse.json({error:'Student unavailable.'},{status:503});if(!member.data)return NextResponse.json({error:'Student not found.'},{status:404});
    const [events,session,feedback]=await Promise.all([
      admin.from('studio_events').select('id,kind,detail,blueprint,revision,created_at').eq('classroom_id',id).eq('user_id',student).order('created_at',{ascending:false}).limit(100),
      admin.from('learning_sessions').select('blueprint,code,draft_hash,updated_at').eq('user_id',student).eq('classroom_id',id).eq('challenge_id','contains-duplicate').maybeSingle(),
      admin.from('classroom_feedback').select('note,rubric').eq('classroom_id',id).eq('user_id',student).maybeSingle(),
    ]);
    if(events.error||session.error||feedback.error)return NextResponse.json({error:'Learning evidence unavailable.'},{status:503});
    return NextResponse.json({student:member.data,events:events.data,session:session.data,feedback:feedback.data},{headers:{'Cache-Control':'private, no-store'}});
  }
  const result=await admin.from('classroom_members').select('user_id,display_name,joined_at').eq('classroom_id',id).order('joined_at');
  return result.error?NextResponse.json({error:'Class members unavailable.'},{status:503}):NextResponse.json({classroom:access.classroom,members:result.data},{headers:{'Cache-Control':'private, no-store'}});
}
export async function PATCH(request:NextRequest,context:Context){
  if(!sameOrigin(request))return NextResponse.json({error:'Invalid request origin.'},{status:403});
  const {id}=await context.params;const access=await owned(id);if('error' in access)return NextResponse.json({error:access.error},{status:access.status});
  let payload;try{payload=await readBody(request,5000);}catch{return NextResponse.json({error:'Invalid class update.'},{status:400});}
  const schema=z.discriminatedUnion('kind',[z.object({kind:z.literal('settings'),settings:classSettingsSchema}).strict(),z.object({kind:z.literal('feedback'),student:z.string().uuid(),note:z.string().max(2000),rubric:rubricSchema}).strict()]);
  const body=schema.safeParse(payload);if(!body.success)return NextResponse.json({error:'Invalid class update.'},{status:400});
  const admin=adminClient();
  if(body.data.kind==='settings'){
    const result=await admin.from('classrooms').update(body.data.settings).eq('id',id);
    return result.error?NextResponse.json({error:'Settings could not save.'},{status:503}):NextResponse.json({saved:true});
  }
  const member=await admin.from('classroom_members').select('user_id').eq('classroom_id',id).eq('user_id',body.data.student).maybeSingle();
  if(member.error)return NextResponse.json({error:'Class membership unavailable.'},{status:503});if(!member.data)return NextResponse.json({error:'Student not found.'},{status:404});
  const result=await admin.from('classroom_feedback').upsert({classroom_id:id,user_id:body.data.student,note:body.data.note,rubric:body.data.rubric,updated_at:new Date().toISOString()});
  return result.error?NextResponse.json({error:'Feedback could not save.'},{status:503}):NextResponse.json({saved:true});
}
