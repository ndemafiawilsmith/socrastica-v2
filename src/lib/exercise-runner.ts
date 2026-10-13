import 'server-only';
import { runPlan, type Exercise, type Plan } from './exercises';
import { sameValue } from './values';
import { runSandbox } from './sandbox';

// Code for an exercise must match both the reference answer and the student's own plan.
export async function testExerciseCode(code: string, exercise: Exercise, plan: Plan) {
  const cases = exercise.cases.map(input => ({ input, expected: runPlan(exercise.solution, input).result }));
  const plans = exercise.cases.map(input => runPlan(plan, input));
  const report = await runSandbox({
    language: 'typescript', code, functionName: 'solve', cases,
    accept: (actual, index) => plans[index].error || !sameValue(actual, plans[index].result) ? 'The result differs from your plan.' : null,
  });
  return report.results.map(({ input, expected, actual, passed }) => ({ input, expected, actual, passed }));
}
