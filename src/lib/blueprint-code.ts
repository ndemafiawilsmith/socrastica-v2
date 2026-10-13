import 'server-only';
import { createHash } from 'node:crypto';
import { blueprintKey, simulate, type Blueprint } from './blueprint';
import { verificationInputs, type Challenge } from './challenges';
import { runSandbox, SandboxError, type SandboxReport } from './sandbox';
import { sameValue } from './values';

export function draftHash(blueprint: Blueprint, code: string) { return createHash('sha256').update(blueprintKey(blueprint) + '\n' + code).digest('hex'); }

// Runs code against the challenge oracle on every verification input.
export async function runChallengeCode(code: string, challenge: Challenge, extra?: { blueprint: Blueprint }): Promise<SandboxReport> {
  const inputs = verificationInputs(challenge);
  const cases = inputs.map((input, index) => ({ name: challenge.sampleCases[index]?.name || `Random input ${index - challenge.sampleCases.length + 1}`, input, expected: challenge.oracle(input) }));
  const traces = extra ? inputs.map(input => simulate(extra.blueprint, input, { record: false })) : [];
  return runSandbox({ language: 'typescript', code, functionName: challenge.functionName, cases, accept: extra ? (actual, index) => traces[index].error || !sameValue(actual, traces[index].result) ? 'The result differs from your blueprint.' : null : undefined });
}

// An AI draft must reproduce both the oracle and the student's blueprint before it is saved.
export async function verifyBlueprintCode(code: string, blueprint: Blueprint, challenge: Challenge) {
  const report = await runChallengeCode(code, challenge, { blueprint });
  const failed = report.results.find(result => !result.passed);
  if (failed) throw new SandboxError(failed.error?.startsWith('The result') ? 'The draft does not match your blueprint on the sample inputs.' : failed.error || 'The draft failed a sample input.');
  return report.total;
}
