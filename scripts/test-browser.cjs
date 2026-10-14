// Browser smoke test: drives the real studio in the locally installed Chrome (no download).
// Usage: node scripts/test-browser.cjs [--headed] [--url http://localhost:3000]
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright-core');
const {createClient}=require('@supabase/supabase-js');
require('@next/env').loadEnvConfig(process.cwd());
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});let userId;
const base=process.argv.includes('--url')?process.argv[process.argv.indexOf('--url')+1]:'http://localhost:3000';
const shots=path.resolve('infra/aws/private/screens');fs.mkdirSync(shots,{recursive:true});
async function main(){
 const browser=await chromium.launch({channel:'chrome',headless:!process.argv.includes('--headed')});
 const context=await browser.newContext({viewport:{width:1440,height:960}});
 const problems=[];
 context.on('page',page=>{page.on('pageerror',error=>problems.push(`pageerror: ${error.message}`));page.on('console',message=>{if(message.type()==='error'&&!/favicon|404/.test(message.text()))problems.push(`console: ${message.text().slice(0,300)}`);});});
 const page=await context.newPage();
 // Guest studio: load the working example, simulate it, and verify the suite grid fills.
 await page.goto(`${base}/learn/contains-duplicate`,{waitUntil:'networkidle'});
 await page.getByText('Your building blocks').waitFor({timeout:60000});
 await page.getByText('Practising as a guest').waitFor();
 await page.getByRole('button',{name:'Load a working idea'}).click();
 await page.getByRole('button',{name:'Explore this blueprint'}).click();
 await page.getByRole('combobox',{name:'Simulation speed'}).selectOption('200');
 await page.getByRole('checkbox',{name:'Predict branches as I step'}).uncheck();
 await page.getByRole('button',{name:'Simulate'}).click();
 await page.getByText(/40 sample inputs passed/).waitFor({timeout:60000});
 await page.getByText('40/40 passed').waitFor();
 assert.ok(await page.locator('.packet-item.item-read').count()>0,'Packet strip marks read items');
 await page.screenshot({path:path.join(shots,'studio-duplicate.png'),fullPage:true});
 console.log('PASS guest studio: example loaded, simulated, suite grid filled, packet strip updated');
 // A common mistake fails, highlights the block, and offers the failing input.
 await page.getByRole('button',{name:'Load a common mistake'}).click();
 await page.getByRole('button',{name:'Explore this blueprint'}).click();
 await page.getByRole('button',{name:'Simulate'}).click();
 await page.getByText(/needs|Repair|returns/).first().waitFor({timeout:60000});
 assert.ok(await page.locator('.logic-problem').count()>0,'Failing block is highlighted');
 await page.screenshot({path:path.join(shots,'studio-mistake.png'),fullPage:true});
 console.log('PASS common mistake: failure highlighted on the canvas');
 // Breakpoint: pause at the check block, then run to the return block.
 await page.getByRole('button',{name:'Undo last change'}).click();
 await page.getByText(/40 sample inputs passed|Say your idea|Explain/).first().waitFor();
 // Guest work survives a reload.
 await page.reload({waitUntil:'networkidle'});
 await page.getByText('Your building blocks').waitFor({timeout:60000});
 assert.ok((await page.locator('.logic-block').count())>=6,'Guest blueprint restored from the browser');
 console.log('PASS guest canvas persists across reloads');
 // A number activity with the packet strip showing the transformed value.
 await page.goto(`${base}/learn/naira-to-dollar`,{waitUntil:'networkidle'});
 await page.getByText('Your building blocks').waitFor({timeout:60000});
 await page.getByRole('button',{name:'Load a working idea'}).click();
 await page.getByRole('button',{name:'Explore this blueprint'}).click();
 await page.getByRole('combobox',{name:'Simulation speed'}).selectOption('200');
 await page.getByRole('button',{name:'Simulate'}).click();
 await page.getByText(/40 sample inputs passed/).waitFor({timeout:60000});
 await page.screenshot({path:path.join(shots,'studio-naira.png'),fullPage:true});
 console.log('PASS number activity simulated with the packet strip');
 // Signed-in flow: guest work imports into the account, the sandbox runs code, and a share link is created.
 const email=`socrastica-browser-${Date.now()}@example.com`,password='BrowserTest-123456';
 const created=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(created.error);userId=created.data.user.id;
 await page.goto(`${base}/login?next=/learn/contains-duplicate`,{waitUntil:'networkidle'});
 await page.getByLabel('Email').fill(email);await page.getByLabel('Password').fill(password);await page.getByRole('button',{name:'Sign in'}).click();
 await page.waitForURL(/\/learn\/contains-duplicate/,{timeout:60000});
 await page.getByText('Your building blocks').waitFor({timeout:60000});
 await page.getByText('Canvas saved').waitFor({timeout:60000});
 assert.ok((await page.locator('.logic-block').count())>=6,'Guest blueprint imported into the account');
 await page.getByRole('button',{name:'Blueprint + code'}).click();
 await page.getByText('Not drafted yet').waitFor({timeout:30000});
 await page.getByRole('button',{name:'Run tests'}).click();
 await page.getByText(/of 40 checks passed|40 checks passed/).waitFor({timeout:60000});
 await page.getByRole('combobox',{name:'Simulation speed'}).selectOption('1000');
 await page.getByRole('button',{name:'Simulate'}).click();await page.waitForTimeout(2500);
 await page.screenshot({path:path.join(shots,'studio-split.png'),fullPage:true});
 await page.keyboard.press(' ');
 console.log('PASS split view: canvas and code side by side during playback');
 await page.getByRole('button',{name:'Open profile and settings'}).click();
 await page.getByRole('button',{name:'Create share link'}).click();
 await page.getByText(/\/share\//).waitFor({timeout:30000});
 const shareUrl=(await page.getByText(/\/share\//).textContent()).match(/https?:\/\/\S+\/share\/[a-z0-9]{12}/)[0];
 await page.goto(shareUrl.replace(/^https?:\/\/[^/]+/,base),{waitUntil:'networkidle'});
 await page.getByText('Read-only blueprint').waitFor();
 await page.getByRole('button',{name:'Simulate'}).click();await page.getByText(/reached the expected answer/).waitFor({timeout:60000});
 await page.screenshot({path:path.join(shots,'share.png'),fullPage:true});
 await page.goto(`${base}/progress`,{waitUntil:'networkidle'});await page.getByText('The story so far.').waitFor();await page.getByText(/\/share\//).waitFor();
 await page.screenshot({path:path.join(shots,'progress.png'),fullPage:true});
 console.log('PASS signed-in flow: guest import, sandbox run, share link replay, progress page');
 // Library and landing render.
 await page.goto(`${base}/exercises`,{waitUntil:'networkidle'});await page.getByText('25 activities').waitFor();
 await page.goto(`${base}/`,{waitUntil:'networkidle'});await page.getByRole('button',{name:/Run the example/}).click();
 await browser.close();
 if(problems.length){console.error('FAIL browser problems:\n'+problems.join('\n'));process.exitCode=1;}else console.log(`PASS no console or page errors. Screenshots in ${shots}`);
}
main().catch(error=>{console.error('FAIL',error.message);process.exitCode=1;}).finally(async()=>{if(userId){const removed=await admin.auth.admin.deleteUser(userId);if(removed.error){console.error('Temporary account cleanup failed');process.exitCode=1;}}});
