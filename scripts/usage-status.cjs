require('@next/env').loadEnvConfig(process.cwd());
const {createClient}=require('@supabase/supabase-js');
async function main(){
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});
 const {data:budget,error}=await db.from('ai_budget').select('reserved_microdollars,limit_microdollars').eq('id',true).single();
 if(error) throw error;
 const {data:requests,error:requestsError}=await db.from('ai_requests').select('status,input_tokens,output_tokens');
 if(requestsError)throw requestsError;
 const tokens=requests.reduce((sum,r)=>({input:sum.input+(r.input_tokens||0),output:sum.output+(r.output_tokens||0)}),{input:0,output:0});
 console.log(JSON.stringify({model:process.env.OPENAI_MODEL,attempts:requests.length,completed:requests.filter(r=>r.status==='completed').length,reservedDollars:budget.reserved_microdollars/1e6,reservationLimitDollars:budget.limit_microdollars/1e6,inputTokens:tokens.input,outputTokens:tokens.output,estimatedTokenCostDollars:(tokens.input*.1+tokens.output*.5)/1e6}));
}
main().catch(()=>{console.log('Usage verification failed; no secrets displayed.');process.exitCode=1;});
