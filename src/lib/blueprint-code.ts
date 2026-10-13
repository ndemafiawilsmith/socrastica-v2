import 'server-only';
import { createHash } from 'node:crypto';
import { blueprintKey, simulate, verificationInputs, type Blueprint } from './blueprint';
import { runSandbox, SandboxError } from './sandbox';

export function draftHash(blueprint: Blueprint, code: string) { return createHash('sha256').update(blueprintKey(blueprint) + '\n' + code).digest('hex'); }

// An AI draft must reproduce the student's blueprint on every verification input before it is saved.
export async function verifyBlueprintCode(code: string, blueprint: Blueprint) {
  const cases = verificationInputs().map(input => {
    const expected = simulate(blueprint, input, false);
    if (!expected.passed) throw new SandboxError('The blueprint no longer passes simulation.');
    return { input, expected: expected.result as boolean };
  });
  const report = await runSandbox({ language: 'typescript', code, functionName: 'containsDuplicate', cases });
  const failed = report.results.find(result => !result.passed);
  if (failed) throw new SandboxError(failed.error?.startsWith('The result') ? 'The draft does not match your blueprint on the sample inputs.' : failed.error || 'The draft failed a sample input.');
  return report.total;
}
