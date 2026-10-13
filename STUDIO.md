# Architecture studio

Open `/studio` after signing in. The current sandbox supports the duplicate-detection challenge.

1. Speak a direction or type it into the director strip. Mentioned concepts appear during speech; a pause or Send asks the AI for a proposal. Review its changes and apply or discard it. Listening notes and proposals do not overwrite your saved canvas. Microphone access is opt-in. Recognition depends on browser support and may use the browser provider's remote speech service.
2. Drag blocks from the library, or click to add them. Connect an output handle to another block's input. A connection replaces the existing connection on that output. Select a block to rename or remove it; select an edge and press Delete to remove a connection. Pan, zoom, and Fit view are available.
3. Choose a sample or enter a JSON array, then Simulate. Pause, step backward or forward, scrub through the trace, or change playback speed. Branch predictions pause playback by default; choose a path in the Learning guide, then continue. Answers are checked on the saved graph by the server. The packet and seen set show the actual interpreted state. A dead end or incorrect result highlights the block to revisit.
4. A successful trace triggers the 40-input suite. Automatic drafting is off initially; students choose when to inspect the code. Once the suite passes, AI code streams into Monaco, then an isolated runtime checks it on the same inputs before saving. Run tests invokes the separate ECS runner.

## Executable blocks

| Block | Meaning | Outputs |
| --- | --- | --- |
| Input | Receives the input array | next |
| Memory shelf | Creates or resets memory | next |
| Next number | Takes the next item and advances the cursor | yes: item, no: exhausted |
| Seen before? | Checks membership of the current item | yes: repeat, no: new |
| Remember number | Adds the current item to memory | next |
| Return true / false | Finishes with a boolean | none |

Labels are descriptions; they never execute. Arbitrary code cannot be embedded into nodes. Changing an operation or connection invalidates simulation approval and the saved draft's verification status. Moving or renaming blocks preserves verification.

## Persistence and API

- `GET /api/studio`: load or initialize the signed-in user's session.
- `PATCH /api/studio`: save blueprint and code with a revision check.
- `POST /api/studio/direct`: produce one budgeted AI proposal for review, leaving the saved canvas intact.
- `POST /api/studio/generate`: recheck the saved blueprint, stream code as NDJSON, verify it in QuickJS, then save with a revision check.

The additive migration `202610040001_blueprint.sql` stores the blueprint, revision, note, and draft fingerprint. Account isolation uses existing Supabase RLS. A stale legacy progress tab cannot overwrite code in a canvas session.

Both studio AI endpoints share the existing atomic $2 testing allowance, $0.01 reservation per attempt, 20 requests per user per day, cooldown, and one active request per user. No automatic paid retries or audio-model calls are introduced. Simulation does not require an AI request. Test success is finite evidence, not a guarantee that AI generates flawless code.

## Validation

`npm run test:blueprint` tests graph interpretation, branches, memory, failures, stream decoding, and isolated generated-code verification. With a local server running, `npm run test:studio` tests auth, persistence, conflicts, ownership, and incomplete-blueprint spending protection. Run `node scripts/test-studio.cjs --live` only when intentionally testing two paid calls. The script creates and removes its own confirmed test users without sending email.

Microphone capture still needs a manual check on a supported browser and device. Text direction is the fallback. This release's local validation does not establish that the AWS instance is running the new version; deploy it through the release process in `infra/aws/HOSTING.md`.

## Teaching and instructor review

The Learning guide offers one concrete repair at a time, a Show me why explanation, and a memory demonstration for memory-related blocks. Preview before applying; Undo/Redo lets students experiment safely. Selecting a block explains its inputs and effects; new generated drafts carry node comments so corresponding code can be highlighted. A local Undo stack is not retained after reload; saved blueprint snapshots are available through the journal.

The journal retains revisions, AI proposals, hints, server-checked predictions, experiments, and student reflections. The view shows the latest 100 activities, compares graph versions, and previews restoration without changing code automatically. Assistance and finite test results are evidence for human review, not an automated grade. Activity recording is limited to 500 events per user per rolling 24 hours.

Apply additive migration `202610050001_teaching.sql` after the blueprint migration. It adds private classes, membership, feedback, activity history, and service-only transactional save/event functions. Evidence submission checks the revision under the same database lock used to save the canvas. A recorded failing experiment prevents code drafting on that unchanged graph.

Open `/instructor` to create a class, share its invite code, set hint depth, require a correct branch prediction before drafting, or pause code drafting. Students explicitly join from their studio and choose a display name. Joining shares the current duplicate-detection graph/code and subsequent activity with that class owner. Earlier private entries stay private. Returning to private practice hides subsequent work; already-shared evidence remains accessible to the class owner. Each session has one active class. Class owners cannot inspect unrelated students or another instructor's class. Invite codes are visible only to owners. This is a formative learning workspace, not an exam lockdown system.

Instructor review includes current shared architecture/code, version comparison, evidence of assistance and experiments, student explanations, and manual rubric feedback for memory, branching, and edge cases. Student settings are refreshed on reload or class join; drafting permissions and graph-specific predictions are checked again on the server before spending and at commit.

With the production server running, `node scripts/test-teaching.cjs` checks sharing boundaries, RLS, revision races, forged predictions, instructor policy without AI spending, feedback, and returning to private practice. Test accounts are created and removed automatically.
