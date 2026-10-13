import 'server-only';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { getQuickJS } from 'quickjs-emscripten';
import { blueprintKey,simulate, verificationInputs, type Blueprint } from './blueprint';
export function draftHash(blueprint:Blueprint,code:string){return createHash('sha256').update(blueprintKey(blueprint)+'\n'+code).digest('hex');}

export async function verifyBlueprintCode(code:string,blueprint:Blueprint){
  if(Buffer.byteLength(code)>15000)throw new Error('The draft is too large.');
  const source=ts.createSourceFile('draft.ts',code,ts.ScriptTarget.ES2020,true);
  if(source.statements.some(statement=>ts.isImportDeclaration(statement)||ts.isImportEqualsDeclaration(statement)||ts.isExportDeclaration(statement)||ts.isExportAssignment(statement)||(ts.canHaveModifiers(statement)&&ts.getModifiers(statement)?.some(modifier=>modifier.kind===ts.SyntaxKind.ExportKeyword))))throw new Error('The draft must be a standalone function without imports or exports.');
  const compiled=ts.transpileModule(code,{reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None}});
  if(compiled.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error))throw new Error('The AI draft contains invalid TypeScript.');
  const engine=await getQuickJS();const deadline=Date.now()+2500;const inputs=verificationInputs();
  for(const input of inputs){
    const expected=simulate(blueprint,input,false);
    if(!expected.passed)throw new Error('The blueprint no longer passes simulation.');
    const runtime=engine.newRuntime();runtime.setMemoryLimit(32*1024*1024);runtime.setMaxStackSize(512*1024);
    const caseDeadline=Math.min(deadline,Date.now()+150);runtime.setInterruptHandler(()=>Date.now()>caseDeadline);
    const vm=runtime.newContext();
    try{
      const loaded=vm.evalCode(compiled.outputText,'draft.js');
      if(loaded.error){loaded.error.dispose();throw new Error('The draft could not initialize within its limits.');}loaded.value.dispose();
      const fn=vm.getProp(vm.global,'containsDuplicate');const args=vm.newArray();
      try{
        if(vm.typeof(fn)!=='function')throw new Error('The draft needs a containsDuplicate function.');
        input.forEach((number,index)=>{const value=vm.newNumber(number);vm.setProp(args,index,value);value.dispose();});
        const result=vm.callFunction(fn,vm.undefined,args);
        if(result.error){result.error.dispose();throw new Error('The draft failed a sample input or exceeded its runtime limit.');}
        try{if(vm.typeof(result.value)!=='boolean'||vm.dump(result.value)!==expected.result)throw new Error('The draft does not match your blueprint on the sample inputs.');}finally{result.value.dispose();}
      }finally{fn.dispose();args.dispose();}
    }finally{vm.dispose();runtime.dispose();}
  }
  return inputs.length;
}
