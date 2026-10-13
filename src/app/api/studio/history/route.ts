import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { serverClient,adminClient } from '@/lib/supabase/server';
import { blueprintSchema,blueprintKey,emptyBlueprint,simulate,simulateSuite } from '@/lib/blueprint';
import { predictionChoices } from '@/lib/guidance';
import { recordEvent } from '@/lib/teaching-server';
import { StudioError } from '@/lib/studio-ai';
import { sameOrigin,readBody } from '@/lib/http';
export const dynamic='force-dynamic';
const input=z.array(z.number().finite()).max(100);
const eventSchema=z.discriminatedUnion('kind',[
  z.object({kind:z.literal('prediction'),revision:z.number().int().min(0),input,step:z.number().int().min(0).max(4099),answer:z.string().min(1).max(40)}).strict(),
  z.object({kind:z.literal('simulation'),revision:z.number().int().min(0),input}).strict(),
  z.object({kind:z.literal('reflection'),revision:z.number().int().min(0),text:z.string().trim().min(1).max(1000)}).strict(),
  z.object({kind:z.literal('hint'),revision:z.number().int().min(0),action:z.enum(['why','preview','applied']),title:z.string().max(100)}).strict(),
]);
export async function GET(){
  const db=await serverClient();const {data:{user}}=await db.auth.getUser();
  if(!user)return NextResponse.json({error:'Sign in to view your learning journal.'},{status:401});
  const result=await db.from('studio_events').select('id,kind,detail,blueprint,revision,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100);
  return result.error?NextResponse.json({error:'Your journal could not load.'},{status:503}):NextResponse.json({events:result.data},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(request:NextRequest){
  if(!sameOrigin(request))return NextResponse.json({error:'Invalid request origin.'},{status:403});
  try{
    const db=await serverClient();const {data:{user}}=await db.auth.getUser();if(!user)return NextResponse.json({error:'Sign in to save learning evidence.'},{status:401});
    let payload;try{payload=await readBody(request,8000);}catch{return NextResponse.json({error:'Invalid activity.'},{status:400});}
    const parsed=eventSchema.safeParse(payload);if(!parsed.success)return NextResponse.json({error:'Invalid activity.'},{status:400});const body=parsed.data;
    const {data:session,error}=await adminClient().from('learning_sessions').select('blueprint,blueprint_revision').eq('user_id',user.id).eq('challenge_id','contains-duplicate').single();if(error)throw error;
    if(session.blueprint_revision!==body.revision)throw new StudioError('Your blueprint changed. Try this activity on the saved version.',409);
    const graph=blueprintSchema.parse(session.blueprint||emptyBlueprint);
    let detail:Record<string,unknown>;
    if(body.kind==='prediction'){
      const trace=simulate(graph,body.input),frame=trace.frames[body.step],choices=predictionChoices(graph,frame);
      if(!frame||choices.length<2||!choices.some(choice=>choice.answer===body.answer)||!trace.frames[body.step+1])return NextResponse.json({error:'Choose a branch on a valid simulation step.'},{status:400});
      const correct=body.answer===trace.frames[body.step+1].nodeId;
      detail={input:body.input,step:body.step,nodeId:frame.nodeId,answer:body.answer,correct,expected:trace.frames[body.step+1].nodeId,graphKey:blueprintKey(graph)};
    }else if(body.kind==='simulation'){
      const trace=simulate(graph,body.input),suite=simulateSuite(graph);
      detail={input:body.input,passed:trace.passed,error:trace.error||null,nodeId:trace.nodeId||null,suitePassed:suite.passed,passedCount:suite.passedCount,total:suite.total,graphKey:blueprintKey(graph)};
    }else if(body.kind==='reflection')detail={text:body.text};
    else detail={action:body.action,title:body.title};
    const id=await recordEvent(user.id,body.kind,detail,body.kind==='simulation'?graph:null,body.revision);
    return NextResponse.json({id,detail});
  }catch(error){return NextResponse.json({error:error instanceof StudioError?error.message:'Your activity could not be saved.'},{status:error instanceof StudioError?error.status:503});}
}
