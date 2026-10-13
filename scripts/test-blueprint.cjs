const assert=require('node:assert/strict'),fs=require('node:fs'),{load}=require('./load-ts.cjs');
const blueprint=load('src/lib/blueprint.ts'),challenges=load('src/lib/challenges.ts'),guidance=load('src/lib/guidance.ts'),codeModule=load('src/lib/blueprint-code.ts');
const byId=id=>{const c=challenges.findChallenge(id);assert.ok(c,id);return c;};
const suite=(graph,c)=>blueprint.simulateSuite(graph,challenges.verificationInputs(c),c.oracle);
// Independently calculated answers for each challenge's sample input.
const expected={'contains-duplicate':true,'naira-to-dollar':3,'dollar-to-naira':4500,'discount-price':4000,'tip-total':2200,'celsius-fahrenheit':77,'fahrenheit-celsius':25,'minutes-seconds':150,'rectangle-area':12,'rectangle-perimeter':14,'even-number':false,'positive-number':false,'sum-list':10,'average-list':20,'count-even':3,'largest-number':12,'smallest-number':3,'sort-list':[2,5,10],'reverse-text':'olleh','palindrome':true,'text-length':6,'is-sorted':true,'all-positive':true,'sum-positive':9,'contains-negative':true};
async function main(){
 assert.equal(challenges.challenges.length,25);assert.equal(new Set(challenges.challenges.map(c=>c.id)).size,25);
 for(const c of challenges.challenges){
  assert.deepEqual(c.oracle(c.sample),expected[c.id],`${c.id} oracle`);
  assert.ok(blueprint.blueprintSchema.safeParse(c.reference).success,`${c.id} reference schema`);
  assert.deepEqual(blueprint.simulate(c.reference,c.sample).result,expected[c.id],`${c.id} reference trace`);
  const result=suite(c.reference,c);assert.equal(result.passed,true,`${c.id} reference suite: ${result.error} on ${JSON.stringify(result.input)}`);assert.equal(result.total,40);
  for(const input of challenges.verificationInputs(c))challenges.validateInput(c,input);
  assert.ok(c.reference.nodes.every(node=>c.library.some(p=>p.op===node.op)||node.op==='start'),`${c.id} reference uses only offered blocks`);
  if(c.mistake){assert.ok(blueprint.blueprintSchema.safeParse(c.mistake.blueprint).success,`${c.id} mistake schema`);assert.equal(suite(c.mistake.blueprint,c).passed,false,`${c.id} mistake must fail`);}
  assert.ok(challenges.starterCode(c).includes(c.functionName));
 }
 const dup=byId('contains-duplicate'),graph=dup.reference;
 const trace=blueprint.simulate(graph,[1,2,3,2]);assert.equal(trace.result,true);assert.ok(trace.frames.some(frame=>frame.current===3&&frame.seen.includes(2)));
 assert.equal(blueprint.simulate(graph,[]).result,false);
 const missing=structuredClone(graph);missing.edges=missing.edges.filter(edge=>!(edge.source==='memory'));assert.equal(blueprint.simulate(missing,[1]).nodeId,'memory');assert.equal(suite(missing,dup).passed,false);
 const early=structuredClone(graph);early.edges.find(edge=>edge.source==='loop'&&edge.port==='yes').target='yes';assert.equal(blueprint.simulate(early,[1,2,3],{expected:false}).passed,false);assert.ok(blueprint.inspectBlueprint(early).some(issue=>issue.message.includes('first item')));
 const noMemory=structuredClone(graph);noMemory.edges.find(edge=>edge.source==='input').target='loop';assert.equal(blueprint.simulate(noMemory,[1,1]).nodeId,'check');assert.match(blueprint.simulate(noMemory,[1,1]).error,/Memory/);
 const cycle=structuredClone(graph);cycle.edges.find(edge=>edge.source==='memory').target='memory';assert.match(blueprint.simulate(cycle,[]).error,/looping/);
 const ambiguous=structuredClone(graph);ambiguous.edges.push({id:'extra',source:'loop',target:'yes',port:'yes'});assert.equal(suite(ambiguous,dup).passed,false);
 assert.ok(!blueprint.blueprintSchema.safeParse({...graph,nodes:[...graph.nodes,{...graph.nodes[0]}]}).success);
 assert.ok(!blueprint.blueprintSchema.safeParse({...graph,edges:[...graph.edges,{id:'bad',source:'input',target:'missing',port:'next'}]}).success);
 assert.ok(!blueprint.blueprintSchema.safeParse({nodes:[{id:'a',op:'math',label:'x',x:0,y:0,params:{target:'value',op:'eval',amount:1}}],edges:[]}).success,'Unknown settings are rejected');
 assert.ok(!blueprint.blueprintSchema.safeParse({nodes:[{id:'a',op:'return',label:'x',x:0,y:0,params:{what:'process'}}],edges:[]}).success);
 const moved=structuredClone(graph);moved.nodes[0].x=600;moved.nodes[0].label='Anything <script> here';assert.equal(blueprint.blueprintKey(graph),blueprint.blueprintKey(moved));assert.notEqual(blueprint.blueprintKey(graph),blueprint.blueprintKey(early));
 const retuned=structuredClone(byId('naira-to-dollar').reference);retuned.nodes.find(n=>n.op==='math').params.amount=1400;assert.notEqual(blueprint.blueprintKey(retuned),blueprint.blueprintKey(byId('naira-to-dollar').reference),'Parameter changes change the fingerprint');
 // Interpreter errors are specific and point at the block.
 assert.match(blueprint.simulate(blueprint.autoLayout({nodes:[{id:'input',op:'start',label:'In'},{id:'d',op:'math',label:'x',params:{target:'value',op:'divide',amount:0}}],edges:[{id:'e',source:'input',target:'d',port:'next'}]}),5).error,/zero/);
 assert.match(blueprint.simulate(blueprint.autoLayout({nodes:[{id:'input',op:'start',label:'In'},{id:'s',op:'accumulate',label:'x',params:{op:'add'}}],edges:[{id:'e',source:'input',target:'s',port:'next'}]}),[1]).error,/current item/);
 assert.match(blueprint.simulate(blueprint.autoLayout({nodes:[{id:'input',op:'start',label:'In'},{id:'t',op:'transform',label:'x',params:{kind:'reverse'}}],edges:[{id:'e',source:'input',target:'t',port:'next'}]}),[1]).error,/text/);
 // Guidance stays challenge-aware and never edits the student's graph.
 const repairGraph=structuredClone(graph);repairGraph.nodes=repairGraph.nodes.filter(node=>node.op!=='initSet');repairGraph.edges=repairGraph.edges.filter(edge=>edge.source!=='memory');repairGraph.edges.find(edge=>edge.source==='input').target='loop';
 const before=JSON.stringify(repairGraph),help=guidance.guidanceFor(repairGraph,dup);
 assert.ok(help.proposal,'Missing memory offers a concrete repair');assert.equal(JSON.stringify(repairGraph),before);assert.equal(suite(help.proposal.blueprint,dup).passed,true);assert.equal(guidance.blueprintDiff(repairGraph,help.proposal.blueprint).added.length,1);
 const initialHelp=guidance.guidanceFor(blueprint.emptyBlueprint,dup);assert.ok(initialHelp.proposal);assert.equal(initialHelp.proposal.blueprint.nodes.length,2,'Hints offer one step rather than finish the solution');
 const sumHelp=guidance.guidanceFor(blueprint.emptyBlueprint,byId('sum-list'));assert.equal(sumHelp.proposal.blueprint.nodes[1].op,'set','Suggestions follow the challenge reference');
 assert.equal(guidance.predictionChoices(graph,trace.frames.find(frame=>frame.nodeId==='check')).length,2);
 assert.equal(blueprint.partialCode('{"code":"function x() {\\nret'),'function x() {\nret');
 // Voice previews only add blocks the challenge offers.
 assert.equal(blueprint.voicePreview(blueprint.emptyBlueprint,'loop through and remember each number',challenges.allowedOperations(dup)).nodes.length,3);
 assert.equal(blueprint.voicePreview(blueprint.emptyBlueprint,'loop through and remember each number',challenges.allowedOperations(byId('naira-to-dollar'))).nodes.length,1);
 // Isolated draft verification against the oracle and the student's blueprint.
 const good='function containsDuplicate(nums: number[]): boolean { const seen=new Set<number>(); for(const n of nums){if(seen.has(n))return true;seen.add(n);}return false;}';
 assert.equal(await codeModule.verifyBlueprintCode(good,graph,dup),40);
 await assert.rejects(codeModule.verifyBlueprintCode('function containsDuplicate(){return true;}',graph,dup));
 await assert.rejects(codeModule.verifyBlueprintCode('function containsDuplicate(){while(true){}}',graph,dup));
 await assert.rejects(codeModule.verifyBlueprintCode('function containsDuplicate(){return process.env.OPENAI_API_KEY;}',graph,dup));
 await assert.rejects(codeModule.verifyBlueprintCode('import fs from "fs"; function containsDuplicate(){return false;}',graph,dup));
 const average=byId('average-list');
 assert.equal((await codeModule.runChallengeCode('function solve(input: number[]): number { if(!input.length) return 0; const t=input.reduce((a,b)=>a+b,0); return Math.round((t/input.length+Number.EPSILON)*100)/100; }',average)).passed,true);
 assert.equal((await codeModule.runChallengeCode('function solve(input: number[]): number { return input.reduce((a,b)=>a+b,0)/input.length; }',average)).passed,false,'Division by zero on empty input is caught');
 fs.mkdirSync('scripts/fixtures',{recursive:true});fs.writeFileSync('scripts/fixtures/blueprint.json',JSON.stringify(graph,null,2)+'\n');
 console.log('PASS 25 challenges: oracles, reference blueprints on 40 inputs each, common mistakes fail, interpreter errors, guidance, fingerprints, voice previews, and isolated code verification.');
}
main().catch(error=>{console.error('FAIL',error.message);process.exitCode=1});
