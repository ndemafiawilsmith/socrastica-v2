import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { serverClient,adminClient } from '@/lib/supabase/server';
import { sameOrigin,readBody } from '@/lib/http';
export const dynamic='force-dynamic';
export async function GET(){
  const db=await serverClient();const {data:{user}}=await db.auth.getUser();if(!user)return NextResponse.json({error:'Sign in to view classes.'},{status:401});
  const result=await db.from('classrooms').select('id,name,join_code,hint_depth,require_prediction,allow_code').eq('owner_id',user.id).order('created_at',{ascending:false});
  return result.error?NextResponse.json({error:'Classes could not load.'},{status:503}):NextResponse.json({classes:result.data},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(request:NextRequest){
  if(!sameOrigin(request))return NextResponse.json({error:'Invalid request origin.'},{status:403});
  const db=await serverClient();const {data:{user}}=await db.auth.getUser();if(!user)return NextResponse.json({error:'Sign in to create a class.'},{status:401});
  let payload;try{payload=await readBody(request,1000);}catch{return NextResponse.json({error:'Invalid class name.'},{status:400});}
  const body=z.object({name:z.string().trim().min(1).max(80)}).strict().safeParse(payload);if(!body.success)return NextResponse.json({error:'Use a class name under 80 characters.'},{status:400});
  const count=await db.from('classrooms').select('id',{count:'exact',head:true}).eq('owner_id',user.id);if(count.error)return NextResponse.json({error:'Classes unavailable.'},{status:503});if((count.count||0)>=10)return NextResponse.json({error:'You can create up to 10 classes during testing.'},{status:429});
  const result=await adminClient().from('classrooms').insert({owner_id:user.id,name:body.data.name}).select('id,name,join_code,hint_depth,require_prediction,allow_code').single();
  return result.error?NextResponse.json({error:'Class could not be created.'},{status:503}):NextResponse.json(result.data,{status:201});
}
