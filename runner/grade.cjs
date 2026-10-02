const ts = require('typescript');
const { getQuickJS } = require('quickjs-emscripten');
// Expected values stay in the trusted coordinator, outside the student's VM.
const cases = [
  {name:'Repeated value', input:[1,2,3,1], expected:true},
  {name:'Distinct values', input:[1,2,3,4], expected:false},
  {name:'Empty input', input:[], expected:false},
  {name:'Single value', input:[7], expected:false},
  {name:'Negative numbers', input:[-3,2,-3], expected:true},
  {name:'Repeated zero', input:[0,1,0], expected:true},
  {name:'Duplicate at the end', input:[9,8,7,6,6], expected:true},
  {name:'Large distinct input', input:Array.from({length:1000},(_,i)=>i), expected:false}
];
async function grade(code) {
  if (typeof code !== 'string' || Buffer.byteLength(code) > 50000) throw new Error('Invalid code');
  const source = ts.createSourceFile('submission.ts', code, ts.ScriptTarget.ES2020, true);
  // Algorithm exercises are standalone scripts; imports/modules are unsupported.
  if (source.statements.some(s => ts.isImportDeclaration(s) || ts.isImportEqualsDeclaration(s) || ts.isExportDeclaration(s) || ts.isExportAssignment(s) || s.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword))) {
    return {passed:false, summary:'Use a standalone containsDuplicate function without imports or exports.', checks:[]};
  }
  const compiled = ts.transpileModule(code, {reportDiagnostics:true, compilerOptions:{target:ts.ScriptTarget.ES2020, module:ts.ModuleKind.None}});
  if (compiled.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error)) {
    return {passed:false, summary:'TypeScript syntax error. Check the editor and try again.', checks:[]};
  }
  const QuickJS = await getQuickJS();
  const checks = []; let passed = true;
  for (const test of cases) {
    const runtime = QuickJS.newRuntime();
    runtime.setMemoryLimit(32 * 1024 * 1024);
    runtime.setMaxStackSize(512 * 1024);
    const deadline = Date.now() + 750;
    runtime.setInterruptHandler(()=>Date.now()>deadline);
    const vm = runtime.newContext();
    let functionHandle, args, result;
    try {
      result = vm.evalCode(compiled.outputText, 'submission.js');
      if (result.error) { result.error.dispose(); result = null; throw new Error('runtime'); }
      result.value.dispose(); result = null;
      functionHandle = vm.getProp(vm.global, 'containsDuplicate');
      if (vm.typeof(functionHandle) !== 'function') throw new Error('missing');
      args = vm.newArray();
      test.input.forEach((number,index)=>{const value=vm.newNumber(number);vm.setProp(args,index,value);value.dispose();});
      result = vm.callFunction(functionHandle, vm.undefined, args);
      if (result.error) { result.error.dispose(); result=null; throw new Error('runtime'); }
      const actual = vm.typeof(result.value) === 'boolean' ? vm.dump(result.value) : null;
      const ok = actual === test.expected;
      passed &&= ok;
      checks.push(`${ok?'PASS':'FAIL'} · ${test.name}${actual===null?' — return a boolean':''}`);
    } catch(error) {
      passed = false;
      checks.push(`FAIL · ${test.name} — ${Date.now()>deadline?'time limit exceeded':error.message==='missing'?'define containsDuplicate(nums)':'runtime error or memory limit exceeded'}`);
    } finally {
      result?.value?.dispose(); args?.dispose(); functionHandle?.dispose(); vm.dispose(); runtime.dispose();
    }
  }
  return {passed, summary:passed?'All 8 execution tests passed. These tests check behavior, not proof of flowchart equivalence or complexity.':'Some tests did not pass. Review the cases below and try again.', checks};
}
module.exports = {grade};
