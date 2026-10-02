require('@next/env').loadEnvConfig(process.cwd());
const origin='https://socrastica.com';
async function main(){
 const ref=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
 const url=`https://api.supabase.com/v1/projects/${ref}/config/auth`;
 const headers={Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'};
 const read=await fetch(url,{headers});if(!read.ok)throw new Error('Auth configuration read failed');
 const config=await read.json();
 const redirects=new Set((config.uri_allow_list||'').split(',').map(x=>x.trim()).filter(Boolean));
 redirects.add(`${origin}/auth/callback`);
 redirects.add(`${origin}/auth/callback?next=/reset-password`);
 const patch={uri_allow_list:[...redirects].join(',')};
 if(process.argv.includes('--activate')){
  const page=await fetch(origin,{signal:AbortSignal.timeout(15000)});
  if(!page.ok||page.headers.get('x-socrastica-host')!=='socrastica-web')throw new Error('Verified HTTPS deployment is required before switching the auth site URL');
  patch.site_url=origin;
 }
 const result=await fetch(url,{method:'PATCH',headers,body:JSON.stringify(patch)});
 if(!result.ok)throw new Error('Auth configuration update failed');
 const check=await fetch(url,{headers});if(!check.ok)throw new Error('Auth verification read failed');
 const saved=await check.json();
 if(saved.uri_allow_list!==patch.uri_allow_list||(patch.site_url&&saved.site_url!==origin))throw new Error('Auth configuration verification failed');
 console.log(`Production auth callbacks configured. ${patch.site_url?'HTTPS production site URL activated.':'Existing site URL preserved until HTTPS is live.'}`);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
