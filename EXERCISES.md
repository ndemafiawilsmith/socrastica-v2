# Activity library

`/exercises` is public and lists 25 activities with search, category, and level filters. Signed-in learners see their own status on each card. Every activity runs on the same branching canvas; see `STUDIO.md` for the block vocabulary.

Currency activities use a fixed practice rate of ₦1,500 per $1 and never fetch market rates. Discount and tip percentages are fixed problem data.

## Add an activity

Add a `Challenge` entry to `src/lib/challenges.ts`:

- `id`, `title`, `description`, `category`, `level`, `mission`, `concepts`, `hint`.
- `inputKind` (number, list, or text) and optional constraints (`nonnegative`, `integer`, `pair`).
- `functionName`, `signature`, and `returnKind` for the code the drafter must write.
- `sample` and `sampleCases`: named inputs that appear in the dropdown and lead the verification suite. Include empty inputs, negatives when valid, fractions, and counterexamples for plausible wrong plans.
- `oracle`: a pure function with the expected answer. It runs in the browser and on the server.
- `library`: the block presets offered, including sensible distractors. Use the `P` helpers.
- `reference`: a working blueprint built with `chain`, `build`, or `loopGraph`.
- `mistake` (optional): a plausible wrong blueprint and the lesson it teaches.

Then add the independently calculated sample answer to `scripts/test-blueprint.cjs` and run `npm run test:blueprint`. The test checks the oracle, that the reference passes all forty verification inputs, that the mistake fails, and that the reference only uses offered blocks. The library, routes, progress page, and instructor review pick the activity up automatically.

If an activity needs a block that does not exist, extend `paramSchemas`, `blockInfo`, `step`, the lessons in `src/lib/guidance.ts`, the code-drafter semantics in the generate route, and the tests first.
