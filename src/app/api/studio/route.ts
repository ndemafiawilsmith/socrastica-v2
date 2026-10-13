import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { serverClient,adminClient } from '@/lib/supabase/server';
import { blueprintSchema,emptyBlueprint,blueprintKey } from '@/lib/blueprint';
import { starterCode } from '@/lib/mentor';
import { welcomeMessage } from '@/lib/learning';
import { sameOrigin,readBody } from '@/lib/http';
import { learningContext } from '@/lib/teaching-server';
export const dynamic='force-dynamic';
const fields='blueprint,blueprint_revision,blueprint_note,draft_hash,code';
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){
  try{
    const db=await serverClient();const {data:{user}}=await db.auth.getUser();if(!user)return response({error:'Sign in to open your canvas.'},401);
    const admin=adminClient();const init=await admin.from('learning_sessions').upsert({user_id:user.id,code:starterCode,messages:[welcomeMessage]},{onConflict:'user_id,challenge_id',ignoreDuplicates:true});if(init.error)throw init.error;
    const {data,error}=await db.from('learning_sessions').select(fields).eq('user_id',user.id).eq('challenge_id','contains-duplicate').single();if(error)throw error;
    return response({...data,blueprint:data.blueprint||emptyBlueprint,email:user.email,...await learningContext(user.id)});
  }catch{return response({error:'Your saved canvas is unavailable. Retry loading it.'},503);}
}
export async function PATCH(request:NextRequest){
  if(!sameOrigin(request))return response({error:'Invalid request origin.'},403);
  try{
    const db=await serverClient();const {data:{user}}=await db.auth.getUser();if(!user)return response({error:'Sign in to save your canvas.'},401);
    let payload;try{payload=await readBody(request,75000);}catch{return NextResponse.json({error:'Invalid or oversized request.'},{status:400});}
    const body=z.object({blueprint:blueprintSchema,code:z.string().max(40000),revision:z.number().int().min(0)}).strict().safeParse(payload);
    if(!body.success)return response({error:'Invalid or oversized canvas.'},400);
    const {data:session,error}=await db.from('learning_sessions').select('blueprint,blueprint_revision,draft_hash,code').eq('user_id',user.id).eq('challenge_id','contains-duplicate').single();if(error)throw error;
    if(session.blueprint_revision!==body.data.revision)return response({error:'This canvas changed in another tab. Reload to keep the latest version.'},409);
    const sameBlueprint=blueprintKey(session.blueprint||emptyBlueprint)===blueprintKey(body.data.blueprint);
    const same=sameBlueprint&&session.code===body.data.code;
    const {data:saved,error:saveError}=await adminClient().rpc('save_studio_canvas',{p_user_id:user.id,p_blueprint:body.data.blueprint,p_code:body.data.code,p_revision:body.data.revision,p_same_blueprint:sameBlueprint,p_same_draft:same});
    if(saveError||!saved)return response({error:saveError?.message.includes('REVISION_CONFLICT')?'The canvas changed while saving. Reload before continuing.':'Your canvas and journal could not save. Retry saving before closing.'},saveError?.message.includes('REVISION_CONFLICT')?409:503);
    return response(saved);
  }catch{return response({error:'Your canvas could not be saved. Retry saving before closing.'},503);}
}
