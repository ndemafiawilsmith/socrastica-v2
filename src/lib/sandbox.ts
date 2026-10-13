import 'server-only';
import ts from 'typescript';
import { getQuickJS } from 'quickjs-emscripten';
import { isAllowedValue, sameValue, type Value } from './values';

// Student and AI-written code runs here, inside the web server process, in a fresh
// isolated runtime per test case with memory, stack, and time limits. There is no
// module loader, no host functions, no network, and no access to process or env.
//
// Languages are adapters. TypeScript is transpiled and executed in QuickJS.
// Python would be a second adapter backed by Pyodide (CPython compiled to
// WebAssembly) with the same case list and limits; the routes would not change.

export type Language = 'typescript';
export const languages: Record<Language, { title: string; fileName: string; functionHint: string }> = {
  typescript: { title: 'TypeScript', fileName: 'solution.ts', functionHint: 'a standalone function without imports or exports' },
};

export const limits = { codeBytes: 15000, memoryBytes: 32 * 1024 * 1024, stackBytes: 512 * 1024, caseMs: 150, totalMs: 4000 };

export type SandboxCase = { name?: string; input: Value; expected: Value };
export type SandboxResult = { name?: string; input: Value; expected: Value; actual: Value | null; passed: boolean; error?: string };
export type SandboxReport = { passed: boolean; passedCount: number; total: number; results: SandboxResult[] };

export class SandboxError extends Error {}

type Prepared = { source: string; fileName: string };
type Adapter = (code: string) => Prepared;

const prepareTypeScript: Adapter = code => {
  const file = ts.createSourceFile('solution.ts', code, ts.ScriptTarget.ES2020, true);
  const hasModuleSyntax = file.statements.some(statement =>
    ts.isImportDeclaration(statement) || ts.isImportEqualsDeclaration(statement) || ts.isExportDeclaration(statement) || ts.isExportAssignment(statement) ||
    (ts.canHaveModifiers(statement) && ts.getModifiers(statement)?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)));
  if (hasModuleSyntax) throw new SandboxError('Use a standalone function without imports or exports.');
  const compiled = ts.transpileModule(code, { reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } });
  if (compiled.diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error)) throw new SandboxError('Fix the TypeScript syntax before running.');
  return { source: compiled.outputText, fileName: 'solution.js' };
};

const adapters: Record<Language, Adapter> = { typescript: prepareTypeScript };

export type RunOptions = {
  language: Language;
  code: string;
  functionName: string;
  cases: SandboxCase[];
  // Optional extra acceptance check per case, for example matching the student's own blueprint too.
  accept?: (actual: Value, index: number) => string | null;
};

export async function runSandbox({ language, code, functionName, cases, accept }: RunOptions): Promise<SandboxReport> {
  if (Buffer.byteLength(code) > limits.codeBytes) throw new SandboxError(`Keep the code under ${Math.round(limits.codeBytes / 1000)} KB.`);
  const prepared = adapters[language](code);
  const engine = await getQuickJS();
  const deadline = Date.now() + limits.totalMs;
  const results: SandboxResult[] = [];
  for (const [index, test] of cases.entries()) {
    const runtime = engine.newRuntime();
    runtime.setMemoryLimit(limits.memoryBytes);
    runtime.setMaxStackSize(limits.stackBytes);
    const caseDeadline = Math.min(deadline, Date.now() + limits.caseMs);
    runtime.setInterruptHandler(() => Date.now() > caseDeadline);
    const vm = runtime.newContext();
    const fail = (error: string) => results.push({ name: test.name, input: test.input, expected: test.expected, actual: null, passed: false, error });
    try {
      const loaded = vm.evalCode(prepared.source, prepared.fileName);
      if (loaded.error) { loaded.error.dispose(); fail('The code could not start, or it exceeded its runtime limit.'); continue; }
      loaded.value.dispose();
      const fn = vm.getProp(vm.global, functionName);
      const argument = vm.evalCode(`(${JSON.stringify(test.input)})`);
      try {
        if (argument.error) { argument.error.dispose(); fail('The input could not load.'); continue; }
        const args = argument.value;
        try {
          if (vm.typeof(fn) !== 'function') { fail(`Define a function named ${functionName}.`); continue; }
          const output = vm.callFunction(fn, vm.undefined, args);
          if (output.error) { output.error.dispose(); fail('The code threw an error or exceeded its runtime limit on this input.'); continue; }
          try {
            const actual = vm.dump(output.value) as unknown;
            if (!isAllowedValue(actual)) { fail('Return a boolean, a finite number, text, or a list of numbers.'); continue; }
            const mismatch = !sameValue(actual, test.expected) ? 'The result differs from the expected answer.' : accept?.(actual, index) || null;
            results.push({ name: test.name, input: test.input, expected: test.expected, actual, passed: !mismatch, ...(mismatch ? { error: mismatch } : {}) });
          } finally { output.value.dispose(); }
        } finally { args.dispose(); }
      } finally { fn.dispose(); }
    } finally { vm.dispose(); runtime.dispose(); }
  }
  const passedCount = results.filter(result => result.passed).length;
  return { passed: passedCount === results.length && results.length > 0, passedCount, total: results.length, results };
}
