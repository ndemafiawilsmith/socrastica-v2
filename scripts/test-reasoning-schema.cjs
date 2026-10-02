const fs=require('node:fs');
const assert=require('node:assert/strict');
const Module=require('node:module');
const ts=require('typescript');
const m=new Module(process.cwd()+'/src/lib/reasoning.js');m.paths=module.paths;
m._compile(ts.transpileModule(fs.readFileSync('src/lib/reasoning.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,'reasoning.js');
const {graphSchema,assessmentSchema,graphToMermaid}=m.exports;
const graph={nodes:[
  {id:'start',label:'Receive numbers',kind:'terminal'},
  {id:'set',label:'Create empty set',kind:'process'},
  {id:'next',label:'More numbers?',kind:'decision'},
  {id:'repeat',label:'Number already seen?',kind:'decision'},
  {id:'add',label:'Remember number',kind:'process'},
  {id:'yes',label:'Return true',kind:'terminal'},
  {id:'no',label:'Return false',kind:'terminal'}
],edges:[{from:'start',to:'set',label:''},{from:'set',to:'next',label:''},{from:'next',to:'repeat',label:'Yes'},{from:'next',to:'no',label:'No'},{from:'repeat',to:'yes',label:'Yes'},{from:'repeat',to:'add',label:'No'},{from:'add',to:'next',label:''}]};
assert.ok(graphSchema.safeParse(graph).success);
assert.ok(!graphSchema.safeParse({...graph,nodes:[...graph.nodes,graph.nodes[0]]}).success);
assert.ok(!graphSchema.safeParse({...graph,edges:[{from:'missing',to:'no',label:''},{from:'start',to:'no',label:''}]}).success);
assert.ok(!assessmentSchema.safeParse({reply:'Ready',summary:'Complete',ready:true,graph:null}).success);
const malicious=structuredClone(graph);malicious.nodes[0].label='" click bad <script> %%{init:x}';
const sanitized=graphToMermaid(malicious);assert.ok(!sanitized.includes('<script>'));assert.ok(!sanitized.includes('%%'));assert.ok(!sanitized.includes('{init:'));
fs.mkdirSync('emails/preview',{recursive:true});fs.writeFileSync('emails/preview/sample-map.mmd',graphToMermaid(graph));
console.log('PASS graph references, connectivity, readiness/graph consistency, and Mermaid injection defenses');
