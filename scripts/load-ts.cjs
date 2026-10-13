// Loads a TypeScript source module for test scripts without a build step.
// Relative and "@/" imports resolve to other source files; "server-only" is a no-op.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const cache=new Map();
function resolveSource(base){for(const candidate of [base+'.ts',base+'.tsx',path.join(base,'index.ts')])if(fs.existsSync(candidate))return candidate;return null;}
function load(file){
 const full=path.resolve(file);
 if(cache.has(full))return cache.get(full).exports;
 const module=new Module(full);module.filename=full;module.paths=Module._nodeModulePaths(path.dirname(full));cache.set(full,module);
 const native=module.require.bind(module);
 module.require=name=>{
  if(name==='server-only')return {};
  const source=name.startsWith('.')?resolveSource(path.resolve(path.dirname(full),name)):name.startsWith('@/')?resolveSource(path.resolve('src',name.slice(2))):null;
  return source?load(source):native(name);
 };
 module._compile(ts.transpileModule(fs.readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText,full);
 module.loaded=true;return module.exports;
}
module.exports={load};
