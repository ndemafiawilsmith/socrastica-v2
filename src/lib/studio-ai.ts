import 'server-only';
import { adminClient } from './supabase/server';
import { aiConfigured, aiLimits, approvedModel, providerUrl } from './ai-config';
export class StudioError extends Error{constructor(message:string,public status=503){super(message);}}
export async function reserveStudioAI(userId:string){
  if(!aiConfigured())throw new StudioError('AI drafting is not configured.');
  const {data,error}=await adminClient().rpc('reserve_mentor_request',{p_user_id:userId});
  if(error||!data){const detail=error?.message||'';throw new StudioError(detail.includes('TEST_BUDGET_EXHAUSTED')?'The shared AI testing allowance is used up. You can keep building and simulating.':detail.includes('DAILY_LIMIT')?`You reached the ${aiLimits.dailyRequestsPerUser}-request daily AI allowance. You can keep building and simulating.`:detail.includes('PLEASE_WAIT')?'Give the drafter a moment before requesting another update.':'AI usage tracking is unavailable. No request was sent.',/BUDGET|LIMIT|PLEASE_WAIT/.test(detail)?429:503);}
  return data as string;
}
export async function finishStudioAI(id:string,result?:{usage?:{input_tokens?:number;output_tokens?:number}}){
  await adminClient().from('ai_requests').update({status:result?'completed':'failed',input_tokens:result?.usage?.input_tokens,output_tokens:result?.usage?.output_tokens}).eq('id',id);
}
export function providerOptions(instructions:string,input:string,format:unknown,stream=false){
  return {method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:approvedModel,instructions,input,text:{format},reasoning:{effort:'none'},max_output_tokens:aiLimits.maxOutputTokens,store:false,service_tier:'default',stream}),signal:AbortSignal.timeout(aiLimits.providerTimeoutMs)};
}
export const providerRequest=(instructions:string,input:string,format:unknown,stream=false)=>fetch(providerUrl,providerOptions(instructions,input,format,stream));
export function structuredText(result:{status:string;output?:{type:string;content?:{type:string;text?:string}[]}[]}){
  if(result.status!=='completed')throw new StudioError('The draft was incomplete. Nothing was replaced; no automatic retry was made.');
  return (result.output||[]).filter(item=>item.type==='message').flatMap(item=>item.content||[]).filter(item=>item.type==='output_text').map(item=>item.text||'').join('');
}
