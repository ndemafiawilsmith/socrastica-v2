const fs=require('node:fs'),assert=require('node:assert/strict'),{load}=require('./load-ts.cjs');
const blueprint=load('src/lib/blueprint.ts');
const guidance=load('src/lib/guidance.ts');
const codeModule=load('src/lib/blueprint-code.ts');
const graph={nodes:[
 {id:'input',op:'start',label:'Receive numbers',x:160,y:40},
 {id:'memory',op:'initSet',label:'Create a seen set',x:160,y:155},
 {id:'loop',op:'loop',label:'Take the next number',x:160,y:270},
 {id:'check',op:'has',label:'Seen this number before?',x:160,y:390},
 {id:'remember',op:'add',label:'Remember the number',x:160,y:520},
 {id:'yes',op:'returnTrue',label:'Found a duplicate',x:500,y:510},
 {id:'no',op:'returnFalse',label:'No duplicates',x:500,y:270},
],edges:[{id:'a',source:'input',target:'memory',port:'next'},{id:'b',source:'memory',target:'loop',port:'next'},{id:'c',source:'loop',target:'check',port:'yes'},{id:'d',source:'loop',target:'no',port:'no'},{id:'e',source:'check',target:'yes',port:'yes'},{id:'f',source:'check',target:'remember',port:'no'},{id:'g',source:'remember',target:'loop',port:'next'}]};
async function main(){
 const repairGraph=structuredClone(graph);repairGraph.nodes=repairGraph.nodes.filter(node=>node.op!=='initSet');repairGraph.edges=repairGraph.edges.filter(edge=>edge.source!=='memory');repairGraph.edges.find(edge=>edge.source==='input').target='loop';
 const before=JSON.stringify(repairGraph),help=guidance.guidanceFor(repairGraph);
 assert.ok(help.proposal,'Missing memory offers a concrete repair');assert.equal(JSON.stringify(repairGraph),before,'Hints leave student work intact until applied');assert.equal(blueprint.simulateSuite(help.proposal.blueprint).passed,true,'Memory repair preserves valid decisions and loop');assert.equal(guidance.blueprintDiff(repairGraph,help.proposal.blueprint).added.length,1);
 const initialHelp=guidance.guidanceFor(blueprint.emptyBlueprint);assert.ok(initialHelp.proposal);assert.equal(initialHelp.proposal.blueprint.nodes.length,2,'Hints offer one step rather than finish the solution');
 const predictionTrace=blueprint.simulate(graph,[1,1]);assert.equal(guidance.predictionChoices(graph,predictionTrace.frames.find(frame=>frame.nodeId==='check')).length,2);

 assert.ok(blueprint.blueprintSchema.safeParse(graph).success);assert.equal(blueprint.simulateSuite(graph).passed,true);
 const trace=blueprint.simulate(graph,[1,2,3,2]);assert.equal(trace.result,true);assert.ok(trace.frames.some(frame=>frame.current===3&&frame.seen.includes(2)));
 assert.equal(blueprint.simulate(graph,[]).result,false);
 const missing=structuredClone(graph);missing.edges=missing.edges.filter(edge=>edge.id!=='b');assert.equal(blueprint.simulate(missing,[1]).nodeId,'memory');assert.equal(blueprint.simulateSuite(missing).passed,false);
 const early=structuredClone(graph);early.edges.find(edge=>edge.id==='c').target='yes';assert.equal(blueprint.simulate(early,[1,2,3]).passed,false);assert.ok(blueprint.inspectBlueprint(early).some(issue=>issue.message.includes('first number')));
 const noMemory=structuredClone(graph);noMemory.edges.find(edge=>edge.id==='a').target='loop';assert.equal(blueprint.simulate(noMemory,[1,1]).nodeId,'check');assert.match(blueprint.simulate(noMemory,[1,1]).error,/Memory/);
 const cycle=structuredClone(graph);cycle.edges.find(edge=>edge.id==='b').target='memory';assert.match(blueprint.simulate(cycle,[]).error,/looping/);
 const ambiguous=structuredClone(graph);ambiguous.edges.push({id:'extra',source:'loop',target:'yes',port:'yes'});assert.equal(blueprint.simulateSuite(ambiguous).passed,false);
 assert.ok(!blueprint.blueprintSchema.safeParse({...graph,nodes:[...graph.nodes,{...graph.nodes[0]}]}).success);
 assert.ok(!blueprint.blueprintSchema.safeParse({...graph,edges:[...graph.edges,{id:'bad',source:'input',target:'missing',port:'next'}]}).success);
 const moved=structuredClone(graph);moved.nodes[0].x=600;moved.nodes[0].label='Anything <script> here';assert.equal(blueprint.blueprintKey(graph),blueprint.blueprintKey(moved));assert.notEqual(blueprint.blueprintKey(graph),blueprint.blueprintKey(early));
 assert.equal(blueprint.partialCode('{"code":"function x() {\\nret'),'function x() {\nret');
 const good='function containsDuplicate(nums: number[]): boolean { const seen=new Set<number>(); for(const n of nums){if(seen.has(n))return true;seen.add(n);}return false;}';
 assert.equal(await codeModule.verifyBlueprintCode(good,graph),40);
 await assert.rejects(codeModule.verifyBlueprintCode('function containsDuplicate(){return true;}',graph));
 await assert.rejects(codeModule.verifyBlueprintCode('function containsDuplicate(){while(true){}}',graph));
 await assert.rejects(codeModule.verifyBlueprintCode('function containsDuplicate(){return process.env.OPENAI_API_KEY;}',graph));
 await assert.rejects(codeModule.verifyBlueprintCode('import fs from "fs"; function containsDuplicate(){return false;}',graph));
 fs.mkdirSync('scripts/fixtures',{recursive:true});fs.writeFileSync('scripts/fixtures/blueprint.json',JSON.stringify(graph,null,2)+'\n');
 console.log('PASS actual graph interpretation, memory trace, edge cases, dead ends, cycles, branch nudges, graph validation, semantic fingerprints, stream decoding, and isolated draft verification on 40 inputs.');
}
main().catch(error=>{console.error('FAIL',error.message);process.exitCode=1});
