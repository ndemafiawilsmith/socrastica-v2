import { z } from 'zod';

export const operations = ['start','initSet','loop','has','add','returnTrue','returnFalse'] as const;
export type Operation = typeof operations[number];
export const blocks: Record<Operation,{title:string;description:string;ports:readonly string[]}> = {
  start:{title:'Input',description:'Receive the list of numbers',ports:['next']},
  initSet:{title:'Memory shelf',description:'Remembered numbers · a seen set',ports:['next']},
  loop:{title:'Next number',description:'Take the next item, or finish the list',ports:['yes','no']},
  has:{title:'Seen before?',description:'Check the current number in memory',ports:['yes','no']},
  add:{title:'Remember number',description:'Add the current number to memory',ports:['next']},
  returnTrue:{title:'Return true',description:'A duplicate was found',ports:[]},
  returnFalse:{title:'Return false',description:'No duplicate was found',ports:[]},
};
const id=z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/);
export const blueprintSchema=z.object({
  nodes:z.array(z.object({id,op:z.enum(operations),label:z.string().min(1).max(80),x:z.number().finite().min(-5000).max(5000),y:z.number().finite().min(-5000).max(5000)}).strict()).min(1).max(20),
  edges:z.array(z.object({id,source:id,target:id,port:z.enum(['next','yes','no'])}).strict()).max(40),
}).strict().superRefine((graph,ctx)=>{
  const ids=new Set(graph.nodes.map(node=>node.id));
  if(ids.size!==graph.nodes.length||new Set(graph.edges.map(edge=>edge.id)).size!==graph.edges.length||graph.edges.some(edge=>!ids.has(edge.source)||!ids.has(edge.target)))ctx.addIssue({code:'custom',message:'Invalid blueprint references'});
});
export type Blueprint=z.infer<typeof blueprintSchema>;
export const emptyBlueprint:Blueprint={nodes:[{id:'input',op:'start',label:'Input array',x:200,y:70}],edges:[]};
export function blueprintKey(graph:Blueprint){
  return JSON.stringify({nodes:graph.nodes.map(({id,op})=>({id,op})).sort((a,b)=>a.id.localeCompare(b.id)),edges:graph.edges.map(({source,target,port})=>({source,target,port})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))});
}
export type TraceFrame={nodeId:string;edgeId?:string;index:number;current:number|null;seen:number[];note:string;result?:boolean};
export type Simulation={passed:boolean;frames:TraceFrame[];result?:boolean;error?:string;nodeId?:string};
export function inspectBlueprint(graph:Blueprint):{nodeId:string;message:string}[] {
  const issues:{nodeId:string;message:string}[]=[];
  const starts=graph.nodes.filter(node=>node.op==='start');
  if(starts.length!==1)issues.push({nodeId:graph.nodes[0].id,message:'Use exactly one Input block.'});
  for(const node of graph.nodes){
    const exits=graph.edges.filter(edge=>edge.source===node.id);
    for(const port of blocks[node.op].ports){const count=exits.filter(edge=>edge.port===port).length;if(count!==1)issues.push({nodeId:node.id,message:`Connect one ${port==='next'?'output':port==='yes'?'yes':'no'} path from ${blocks[node.op].title}.`});}
    if(exits.some(edge=>!blocks[node.op].ports.includes(edge.port)))issues.push({nodeId:node.id,message:'This block has a connection on an unsupported output.'});
    if(node.op==='loop'&&exits.some(edge=>edge.port==='yes'&&graph.nodes.find(n=>n.id===edge.target)?.op.startsWith('return')))issues.push({nodeId:node.id,message:'This exits on the first number. Should you check it before returning?'});
  }
  if(starts.length===1){
    const reached=new Set([starts[0].id]);for(let i=0;i<graph.nodes.length;i++)for(const edge of graph.edges)if(reached.has(edge.source))reached.add(edge.target);
    for(const node of graph.nodes)if(!reached.has(node.id))issues.push({nodeId:node.id,message:'This block is disconnected from the input.'});
  }
  return issues;
}
export function simulate(graph:Blueprint,input:number[],record=true):Simulation {
  const frames:TraceFrame[]=[];
  const starts=graph.nodes.filter(node=>node.op==='start');
  if(starts.length!==1)return {passed:false,frames,error:'Use exactly one Input block.',nodeId:graph.nodes[0]?.id};
  let node=starts[0],index=0,current:number|null=null,seen:Set<number>|null=null;
  const fail=(error:string):Simulation=>({passed:false,frames,error,nodeId:node.id});
  // The only executable operations are reviewed pure instructions. Labels never execute.
  for(let count=0;count<Math.min(12000,input.length*40+100);count++){
    let port:'next'|'yes'|'no'='next',note=blocks[node.op].description;
    switch(node.op){
      case 'start':break;
      case 'initSet':seen=new Set();break;
      case 'loop':if(index<input.length){current=input[index++];port='yes';note=`Take ${current} from position ${index-1}`;}else{port='no';note='The list is finished';}break;
      case 'has':if(!seen)return fail('Memory has not been created. Add a Seen set before this check.');if(current===null)return fail('There is no current number. Route through Next number first.');port=seen.has(current)?'yes':'no';note=port==='yes'?`${current} is already in memory`:`${current} is new`;break;
      case 'add':if(!seen)return fail('Create a Seen set before remembering a number.');if(current===null)return fail('Take a number before adding it to memory.');seen.add(current);note=`Remember ${current}`;break;
      case 'returnTrue':case 'returnFalse':{
        const result=node.op==='returnTrue',expected=new Set(input).size<input.length;
        if(record)frames.push({nodeId:node.id,index,current,seen:[...(seen||[])],note:`Return ${result}`,result});
        return {passed:result===expected,frames,result,nodeId:node.id,...(result!==expected?{error:`This path returns ${result}; this input needs ${expected}.`}:{})};
      }
    }
    const exits=graph.edges.filter(edge=>edge.source===node.id&&edge.port===port);
    if(record)frames.push({nodeId:node.id,index,current,seen:[...(seen||[])],note,edgeId:exits.length===1?exits[0].id:undefined});
    if(exits.length!==1)return fail(exits.length?`Choose one ${port} path; this output has several.`:`The packet reached a dead end. Connect the ${port} output.`);
    const next=graph.nodes.find(n=>n.id===exits[0].target);if(!next)return fail('This connection points to a missing block.');node=next;
  }
  return fail('The packet is looping without finishing. Check your loop-back connection.');
}
export const sampleCases=[
  {name:'Repeated value',input:[1,2,3,2]}, {name:'Distinct numbers',input:[1,2,3,4]}, {name:'Empty list',input:[]}, {name:'Single number',input:[7]},
  {name:'Negative numbers',input:[-3,2,-3]}, {name:'Repeated zero',input:[0,1,0]}, {name:'Repeat at the end',input:[9,8,7,6,6]}, {name:'Long distinct list',input:Array.from({length:100},(_,i)=>i)},
];
export function verificationInputs(){
  let seed=4297;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed;};
  return [...sampleCases.map(test=>test.input),...Array.from({length:32},()=>Array.from({length:random()%18},()=>random()%21-10))];
}
export function simulateSuite(graph:Blueprint){
  const structural=inspectBlueprint(graph).filter(issue=>!issue.message.startsWith('This exits'));
  if(structural.length)return {passed:false,total:40,passedCount:0,error:structural[0].message,nodeId:structural[0].nodeId};
  const inputs=verificationInputs();let passedCount=0;
  for(const input of inputs){const result=simulate(graph,input,false);if(!result.passed)return {passed:false,total:inputs.length,passedCount,error:result.error,nodeId:result.nodeId,input};passedCount++;}
  return {passed:true,total:inputs.length,passedCount};
}
export function placeBlueprint(graph:{nodes:{id:string;op:Operation;label:string}[];edges:Blueprint['edges']},previous?:Blueprint):Blueprint{
  return blueprintSchema.parse({...graph,nodes:graph.nodes.map((node,index)=>{
    const old=previous?.nodes.find(n=>n.id===node.id);
    return {...node,x:old?.x??(node.op==='returnTrue'||node.op==='returnFalse'?510:170),y:old?.y??70+index*105};
  })});
}
// Cheap immediate voice preview: adds mentioned concepts, never invents connections.
export function voicePreview(graph:Blueprint,text:string):Blueprint{
  const hints:[Operation,RegExp][]=[['initSet',/\b(set|hash ?map|memory)\b/i],['loop',/\b(loop|iterate|each number|every number)\b/i],['has',/\b(seen before|seen it|already seen|already in|seen a number|seen a value|seen.*before)\b/i],['add',/\b(remember|add.*set|store|keep track)\b/i],['returnTrue',/\b(return true|flag it|found a duplicate)\b/i],['returnFalse',/\b(return false|no duplicate|no repeat)\b/i]];
  const nodes=[...graph.nodes];for(const [op,pattern] of hints)if(pattern.test(text)&&!nodes.some(node=>node.op===op)&&nodes.length<20)nodes.push({id:`voice_${op}`,op,label:blocks[op].title,x:170,y:70+nodes.length*105});
  return {...graph,nodes};
}
export function partialCode(json:string){
  const start=/"code"\s*:\s*"/.exec(json);if(!start)return '';
  let value='',escaped=false;
  for(const char of json.slice(start.index+start[0].length)){
    if(!escaped&&char==='"')break;
    value+=char;
    if(!escaped&&char==='\\')escaped=true;else escaped=false;
  }
  if(escaped)value=value.slice(0,-1);
  try{return JSON.parse('"'+value+'"') as string;}catch{return '';}
}
