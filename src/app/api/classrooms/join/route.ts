import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { serverClient,adminClient } from '@/lib/supabase/server';
import { sameOrigin,readBody } from '@/lib/http';
export async function POST(request:NextRequest){
  if(!sameOrigin(request))return NextResponse.json({error:'Invalid request origin.'},{status:403});
  const db=await serverClient();const {data:{user}}=await db.auth.getUser();if(!user)return NextResponse.json({error:'Sign in to join a class.'},{status:401});
  let payload;try{payload=await readBody(request,1500);}catch{return NextResponse.json({error:'Invalid class details.'},{status:400});}
  const body=z.object({code:z.string().uuid(),name:z.string().trim().min(1).max(50)}).strict().safeParse(payload);if(!body.success)return NextResponse.json({error:'Enter the class code and your name.'},{status:400});
  const result=await adminClient().rpc('join_studio_class',{p_user_id:user.id,p_code:body.data.code,p_name:body.data.name});
  return result.error?NextResponse.json({error:result.error.message.includes('CLASS_NOT_FOUND')?'Class code not found. You cannot join your own class.':'The class could not be joined.'},{status:result.error.message.includes('CLASS_NOT_FOUND')?404:503}):NextResponse.json({joined:true});
}
export async function DELETE(request:NextRequest){
  if(!sameOrigin(request))return NextResponse.json({error:'Invalid request origin.'},{status:403});
  const db=await serverClient();const {data:{user}}=await db.auth.getUser();if(!user)return NextResponse.json({error:'Sign in to return to private practice.'},{status:401});
  const result=await adminClient().from('learning_sessions').update({classroom_id:null}).eq('user_id',user.id).eq('challenge_id','contains-duplicate');
  return result.error?NextResponse.json({error:'Could not return to private practice.'},{status:503}):NextResponse.json({left:true});
}
