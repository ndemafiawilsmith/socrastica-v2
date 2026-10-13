import 'server-only';
import ts from 'typescript';
import { getQuickJS } from 'quickjs-emscripten';
import { runPlan,sameValue,type Exercise,type Plan,type Value } from './exercises';
export async function testExerciseCode(code:string,exercise:Exercise,plan:Plan){
 const source=ts.createSourceFile('exercise.ts',code,ts.ScriptTarget.ES2020,true);
 if(source.statements.some(statement=>ts.isImportDeclaration(statement)||ts.isImportEqualsDeclaration(statement)||ts.isExportDeclaration(statement)||ts.isExportAssignment(statement)||(ts.canHaveModifiers(statement)&&ts.getModifiers(statement)?.some(modifier=>modifier.kind===ts.SyntaxKind.ExportKeyword))))throw new Error('Use a standalone solve function without imports or exports.');
 const compiled=ts.transpileModule(code,{reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None}});
 if(compiled.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error))throw new Error('Fix the TypeScript syntax before running.');
 const engine=await getQuickJS(),deadline=Date.now()+4000;
 const results=[];
 for(const input of exercise.cases){
  const expected=runPlan(exercise.solution,input).result,planResult=runPlan(plan,input);
  const runtime=engine.newRuntime();runtime.setMemoryLimit(32*1024*1024);runtime.setMaxStackSize(512*1024);
  const caseDeadline=Math.min(deadline,Date.now()+150);runtime.setInterruptHandler(()=>Date.now()>caseDeadline);
  const vm=runtime.newContext();
  try{
   const loaded=vm.evalCode(compiled.outputText);if(loaded.error){loaded.error.dispose();throw new Error('Code could not start or exceeded its runtime limit.');}loaded.value.dispose();
   const fn=vm.getProp(vm.global,'solve'),argument=vm.evalCode(`(${JSON.stringify(input)})`);
   try{
    if(argument.error){argument.error.dispose();throw new Error('Input could not load.');}
    const args=argument.value;
    try{
     if(vm.typeof(fn)!=='function')throw new Error('Your code needs a function named solve.');
     const output=vm.callFunction(fn,vm.undefined,args);
     if(output.error){output.error.dispose();throw new Error('Code failed a sample or exceeded its runtime limit.');}
     try{
      const actual=vm.dump(output.value) as Value;
      const allowed=typeof actual==='boolean'||typeof actual==='number'&&Number.isFinite(actual)||typeof actual==='string'&&actual.length<=10000||Array.isArray(actual)&&actual.length<=100&&actual.every(n=>typeof n==='number'&&Number.isFinite(n));
      results.push({input,expected,actual:allowed?actual:null,passed:allowed&&!planResult.error&&sameValue(actual,expected)&&sameValue(actual,planResult.result)});
     }finally{output.value.dispose();}
    }finally{args.dispose();}
   }finally{fn.dispose();}
  }finally{vm.dispose();runtime.dispose();}
 }
 return results;
}
