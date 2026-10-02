import { z } from 'zod';
const nodeSchema=z.object({id:z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,15}$/),label:z.string().min(1).max(90),kind:z.enum(['process','decision','terminal'])}).strict();
const edgeSchema=z.object({from:z.string(),to:z.string(),label:z.string().max(20)}).strict();
export const graphSchema=z.object({nodes:z.array(nodeSchema).min(3).max(12),edges:z.array(edgeSchema).min(2).max(16)}).strict().superRefine((graph,ctx)=>{
  const ids=new Set(graph.nodes.map(n=>n.id));
  if(ids.size!==graph.nodes.length||graph.edges.some(e=>!ids.has(e.from)||!ids.has(e.to)))ctx.addIssue({code:'custom',message:'Invalid graph references'});
  const reached=new Set([graph.nodes[0].id]);
  for(let i=0;i<graph.nodes.length;i++)for(const edge of graph.edges)if(reached.has(edge.from))reached.add(edge.to);
  if(reached.size!==ids.size)ctx.addIssue({code:'custom',message:'Disconnected graph'});
});
export type ReasoningGraph=z.infer<typeof graphSchema>;
export const assessmentSchema=z.object({reply:z.string().min(1).max(1200),ready:z.boolean(),summary:z.string().max(1500),graph:graphSchema.nullable()}).strict().refine(v=>v.ready===(v.graph!==null),{message:'Readiness requires a graph'});
const graphFormat={
  type:'object',additionalProperties:false,required:['nodes','edges'],
  properties:{
    nodes:{type:'array',items:{type:'object',additionalProperties:false,required:['id','label','kind'],properties:{id:{type:'string'},label:{type:'string'},kind:{type:'string',enum:['process','decision','terminal']}}}},
    edges:{type:'array',items:{type:'object',additionalProperties:false,required:['from','to','label'],properties:{from:{type:'string'},to:{type:'string'},label:{type:'string'}}}}
  }
};
export const assessmentFormat={type:'json_schema',name:'reasoning_assessment',strict:true,schema:{
  type:'object',additionalProperties:false,required:['reply','ready','summary','graph'],
  properties:{reply:{type:'string'},ready:{type:'boolean'},summary:{type:'string'},graph:{anyOf:[{type:'null'},graphFormat]}}
}} as const;
// Generate Mermaid ourselves. Never render model-supplied Mermaid directives/HTML.
const label=(value:string)=>value.replace(/[^\p{L}\p{N} .,?!+\-=/():]/gu,' ').trim()||'Step';
export function graphToMermaid(input:ReasoningGraph) {
  const graph=graphSchema.parse(input);
  const ids=new Map(graph.nodes.map((n,i)=>[n.id,`n${i}`]));
  const nodes=graph.nodes.map(n=>{const text=`"${label(n.label)}"`;return `  ${ids.get(n.id)}${n.kind==='decision'?`{${text}}`:n.kind==='terminal'?`([${text}])`:`[${text}]`}`;});
  const edges=graph.edges.map(e=>`  ${ids.get(e.from)} -->${e.label?`|"${label(e.label)}"|`:''} ${ids.get(e.to)}`);
  return ['flowchart TD',...nodes,...edges].join('\n');
}
