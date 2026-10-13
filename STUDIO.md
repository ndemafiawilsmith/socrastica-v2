# The studio and the engine

Every activity opens at `/learn/<id>`. Guests get the full canvas with browser-local state; signing in adds saving, AI drafting, the sandbox, classes, and sharing.

## How a session flows

1. **Explain your idea.** Speak or type a direction. Mentioned blocks appear as listening notes; a pause or Send asks the AI drafter for a proposal built only from the activity's block library. Review it, then apply or keep your canvas.
2. **Build.** Drag blocks from the library or click to add them. Connect outputs to inputs; a connection replaces the existing one on that output. Select a block to rename it, change its number, pause the packet there, run to it, or remove it. Undo and redo cover thirty local steps.
3. **Play and predict.** Choose a sample or type an input, then Simulate. The packet strip lifts the current item and dims read ones; memory, total, count, and the answer update beside it. Blocks light up, loops show their pass count and a progress ring, and the trace scrubber lets you step or scrub. Prediction mode pauses at every decision until you choose a path; answers are checked by the same interpreter on the server for signed-in learners and locally for guests.
4. **Verify.** A successful trace runs the forty verification inputs and fills the suite grid. A failing dot replays that input. Only a blueprint that passes them all can be drafted into code.
5. **Inspect code.** The drafter writes code from your exact blocks with `// node: ID` markers, streams it into the editor, and saves it only after it matches both the oracle and your blueprint in the sandbox. During playback the active block's code highlights. Run tests checks any code you write yourself against the oracle.

The learning guide offers one concrete repair at a time, a "Show me why" explanation, a memory demonstration for memory blocks, and two previews: a working idea and a common mistake. Previews never change your canvas until you apply them, and Undo brings your idea back.

## The block vocabulary

The packet carries five registers: **value** (starts as the input), **current** (the item a loop took), **seen** (a memory set of numbers), **total**, and **count**.

| Block | Settings | Effect | Exits |
| --- | --- | --- | --- |
| Input | | Receives the input | next |
| Memory shelf | | Creates empty memory | next |
| Next item | | Takes the next list item into current | yes (item taken) / no (exhausted) |
| Seen before? | | Is current in memory? | yes / no |
| Remember item | | Adds current to memory | next |
| Set | target total or count; source 0, 1, current, or the first item | Starts or keeps a number | next |
| Accumulate | add or multiply | Folds current into total (starting from 0 or 1) | next |
| Count one | | count + 1 | next |
| Math | target value or total; multiply, divide, add, subtract, round, remainder; a number, the count, or the total | One arithmetic step | next |
| Compare | left register; `> < >= <= == !=`, even, odd, same reversed; a number or register | A decision | yes / no |
| Transform | reverse, lowercase, remove spaces, count characters, sort, count items | Reshapes the value | next |
| Return | true, false, value, total, count, current | Ends the run | none |

Labels describe blocks and never execute. Only settings validated by `paramSchemas` in `src/lib/blueprint.ts` are stored. Changing a block's operation, setting, or connection invalidates simulation approval and the saved draft's verification; moving or renaming preserves it.

## Challenges

`src/lib/challenges.ts` defines each activity: mission, category, level, input kind and constraints, the function signature the code must have, sample cases, an oracle, the block presets offered, a reference blueprint, and a common mistake with its lesson. `verificationInputs` returns the named samples followed by seeded random inputs, always forty in total. The unit test checks every reference passes its suite and every mistake fails.

## Persistence and API

Routes live under `/api/studio/[challenge]`:

- `GET`: open or create the session for the signed-in learner; returns the blueprint, code, revision, class, and feedback.
- `PATCH`: save blueprint and code with a revision check.
- `POST direct`: one budgeted AI proposal for review. The drafter picks blocks by library number, so it cannot propose blocks the activity does not offer.
- `POST generate`: recheck the saved blueprint, stream code as NDJSON, verify it in the sandbox, then commit with a revision check and the class policy enforced inside the SQL function.
- `POST run`: run the saved code against the oracle in the sandbox.
- `GET/POST history`: the learning journal; predictions and simulations are recomputed on the server.

Classes: `/api/classrooms` and `/api/classrooms/join`; joining attaches every session to the class. Sharing: `POST /api/share` snapshots a saved blueprint into `/share/<token>`; `DELETE` revokes it.

The sandbox (`src/lib/sandbox.ts`) transpiles TypeScript and runs each case in a fresh QuickJS runtime with 32 MB, a 150 ms per-case deadline, and no modules, network, or host access. Languages are adapters; a Python adapter would use Pyodide behind the same interface.

## Limits and honesty

AI requests share one $2 testing allowance with per-user daily caps. Sandbox runs are limited per user. Forty passing inputs are evidence, not a proof. Instructor review is evidence for a human, not an automated grade. Voice recognition uses the browser's speech service and may process audio remotely; only the transcript reaches the drafter.
