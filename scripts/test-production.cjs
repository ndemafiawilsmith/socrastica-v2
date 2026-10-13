const assert=require('node:assert/strict');
async function main(){
 const base='http://localhost:3000';
 for(const path of ['/login','/signup','/forgot-password','/reset-password']){
  const response=await fetch(base+path,{signal:AbortSignal.timeout(15000)});assert.equal(response.status,200);const html=await response.text();assert.ok(html.includes('<form'));const asset=html.match(/href="([^\"]+\.css[^\"]*)"/);assert.ok(asset);const css=await fetch(new URL(asset[1].replaceAll('&amp;','&'),base));assert.equal(css.status,200);console.log('PASS '+path+' rendered with stylesheet');
 }
 const studio=await fetch(base+'/studio',{redirect:'manual'});assert.equal(studio.status,307);assert.equal(studio.headers.get('location'),'/learn/contains-duplicate');
 const callback=await fetch(base+'/auth/callback?next=https://example.com',{redirect:'manual'});assert.equal(callback.status,307);assert.ok(new URL(callback.headers.get('location')).pathname==='/login');
 const api=await fetch(base+'/api/studio/contains-duplicate');assert.equal(api.status,401);
 console.log('PASS production protected route, safe auth redirect, and API access guard');
}
main().catch(error=>{console.error('FAIL '+error.message);process.exitCode=1;});
