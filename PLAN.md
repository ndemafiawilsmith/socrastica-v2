# Socrastica upgrade plan

Started October 13, 2026. Each item becomes its own commit on `main`. Boxes are ticked as work lands.

## Decisions already made

- The Fargate runner is retired. Code checks run in-process in QuickJS, the same way exercise checks already do. The AWS execution resources are torn down with the `socrastica` CLI profile after a final confirmation of the exact resource list. The EC2 web host is untouched.
- Python later: QuickJS only runs JavaScript. The in-process route for Python is Pyodide (CPython compiled to WebAssembly), which runs inside the Node server with the same memory and time limits. The new checker lives behind a small language adapter so a Python adapter can be added without touching the routes. Pyodide itself is not installed in this pass.
- New migrations are written and applied to the configured Supabase project as they land.
- The 20 exercises move onto the same branching canvas as the studio. One graph interpreter serves every challenge; each challenge declares which blocks it offers.
- The dead mentor-chat path is deleted, not kept.
- Guest mode covers every challenge: simulation, hints, predictions, undo, and examples work without an account using browser-local state. Saving, AI drafting, classes, and sharing require sign-in.

## Phase 0: baseline

- [x] 0.1 Commit the existing uncommitted studio, teaching, and exercise work as the baseline.

## Phase 1: simplify

- [x] 1.1 In-process code check replaces the Fargate runner. Delete the execute route, execution lib, runner image, watchdog, provisioning and execution test scripts, the AWS SDK dependencies, and the AWS environment variables. Add a migration that drops the execution tables and function.
- [x] 1.2 Tear down the AWS execution resources: ECS cluster and task definition, ECR repository, execution S3 bucket, runner security group, runner and watchdog log groups, watchdog Lambda and EventBridge rule, watchdog and task-execution IAM roles. Narrow the web role policy to nothing execution-related.
- [x] 1.3 Delete the dead mentor chat: Socratic chat, Mermaid flowchart viewer, reasoning schema, mentor and progress routes, learning-session hook, their test scripts, and the Mermaid dependency.
- [x] 1.4 One AI configuration module holds the approved model and budget constants. Routes and tests import it instead of string-matching the model name.

## Phase 2: challenge engine

- [x] 2.1 Universal block vocabulary and interpreter in `src/lib/blueprint.ts`: registers for the packet value, current item, memory set, running total, and count; blocks for start, memory setup, loop, membership, remember, accumulate, tally, set, math, compare, text and list transforms, and typed returns. Nodes carry validated per-block parameters.
- [x] 2.2 Challenge definitions in `src/lib/challenges.ts`: mission, category, input kind and constraints, offered blocks, oracle function, sample cases, verification inputs, a reference graph, and a common-mistake graph. Duplicate detection plus the 20 exercises plus four new branching challenges: largest number, is it sorted, count evens, two sum.
- [x] 2.3 Migration: any challenge id in `learning_sessions`, SQL functions take a challenge id, class membership applies to every challenge, exercise tables retired.
- [x] 2.4 One set of routes under `/api/studio/[challenge]` and one page at `/learn/[id]` for every challenge. `/studio` redirects to duplicate detection. Library, instructor review, and journal read the challenge id.
- [x] 2.5 Code drafting and verification are challenge-generic: the prompt receives the challenge's block descriptions, and verification compares generated code with both the oracle and the student's graph.

## Phase 3: simulation experience

- [x] 3.1 Packet strip above the canvas: the input rendered as a strip with a cursor, the current item lifted, read items dimmed, memory shelf and totals updating per frame. Text and number inputs get their own treatment.
- [x] 3.2 Code-line sync: the active frame's node marker highlights and scrolls the matching code during playback.
- [x] 3.3 Suite grid: the verification suite renders as a grid of dots that fill as inputs pass; a failing dot loads that input.
- [x] 3.4 Loop pass counter badge and iteration ring on loop blocks.
- [x] 3.5 Breakpoints: click a block to pause the packet there; run-to-block.
- [x] 3.6 Seeded examples: "Load a working idea" and "Load a common mistake" per challenge.

## Phase 4: product

- [ ] 4.1 Guest mode with browser-local state, sign-in gates for saving, AI, classes, and sharing, and a one-click import of guest work after sign-in.
- [ ] 4.2 Shareable read-only blueprint links at `/share/[token]` with a replayable trace.
- [ ] 4.3 Student progress page at `/progress`: every challenge with status, reflections, and instructor feedback.

## Phase 5: verification, docs, release

- [ ] 5.1 Update and extend the test scripts for the new engine, routes, guest mode, and sharing. Typecheck, build, and run every script.
- [ ] 5.2 Update README, STUDIO.md, EXERCISES.md, BACKEND_SETUP.md, and the source export list.
- [ ] 5.3 Push to GitHub and deploy with the release helper, after your go-ahead.
