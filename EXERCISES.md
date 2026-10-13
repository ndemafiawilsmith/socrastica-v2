# Exercise library

`/exercises` is public and supports search and category filters. It lists 21 activities: the existing duplicate-detection branching studio, plus 20 ordered-plan activities in money, numbers, lists, and text. Signed-in learners see their own activity status. A new sign-in opens the library; selecting an activity before signing in preserves that destination through login/signup using an allowlist.

## Learning flow

Open `/learn/<id>`. Read the goal, add and reorder operation blocks, and set their numbers. Simulate an example and step forward/backward through actual values. Sample checks expose wrong results, type errors, empty inputs, and other edge cases. Hints explain the idea; they do not silently fill the plan. Save an explanation of why the steps work.

After a plan passes its samples, request one budgeted AI draft or write your own `solve(input)` function. Generated code must match both the saved plan and the expected activity outputs inside isolated QuickJS before saving. The editable Monaco workspace runs these sample tests without access to Node, network, or host credentials. Passing samples is finite evidence, not universal proof. Errors never trigger an automatic paid retry.

Currency activities use a **fixed practice rate of ₦1,500 per $1**, shown in each problem. They do not fetch market rates. Discount and tip percentages are also fixed problem data. These are education activities, not live financial tools.

Each activity has independent account-backed plan/code/reflection/revision/verification state. Saves use a service-only transaction with a revision check; editing the plan or code clears verification. Undo keeps the last 30 local changes and is not retained across reloads. The new ordered-plan activities are private practice. Instructor classes, branching predictions, graph history, and voice-to-canvas remain in `/studio` for duplicate detection; the library does not claim those instructor features apply to every activity yet.

## Setup and limits

Apply `node scripts/migrate.cjs 202610060001_exercises.sql`. The additive tables use RLS for owner-only reads and deny browser writes. AI requests share the existing model, atomic $2 reservation allowance, daily cap, and cooldown. Code runs have a separate service-only atomic limit: 50 per user per rolling 24 hours, 10 seconds between runs across all exercises. Plan simulation has no AI cost.

Plans accept at most 12 whitelisted steps. Inputs allow bounded numbers, strings, or numeric lists, with problem-specific shape/type constraints. Code is capped at 15,000 characters; each isolated test has 32 MB memory, a stack limit, and a 150 ms deadline within a 4-second total deadline. Stale drafts and test results cannot replace newer work.

## Add an activity

Add an `Exercise` entry in `src/lib/exercises.ts`: a unique ID, category, title, goal, input constraints, sample, hint, supported operation plan, and varied test inputs. Include zero/empty inputs, negative numbers when valid, fractions, and counterexamples for plausible wrong plans. Add independently calculated expected answers to `scripts/test-exercises.cjs`. The library and protected route pick up the entry automatically. Update landing-page counts when adding activities.

If the activity needs new operations or branches, extend the interpreter, code translation, provider instructions, and tests first. The ordered-plan editor does not pretend to support arbitrary control-flow graphs; the original studio retains its branching canvas.

## Validation

`npm run test:exercises` checks independently specified sample answers, all 20 reference plans and translated code, edge cases, input validation, sandbox restrictions, and safe auth destinations. With the local server running, `node scripts/test-exercises.cjs --integration` checks isolation, persistence, stale saves, quotas, and spending protection. `--live` additionally makes one intentional paid currency-drafting request. Test users are removed automatically; `--keep` temporarily retains one ignored local test account for browser checks.
