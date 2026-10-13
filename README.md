# Socrastica

A learning studio where you explain an idea, build it from blocks, watch it run on real inputs, and only then let AI turn it into code. Next.js 15, Supabase, an in-process QuickJS sandbox, and one budget-guarded AI model.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:3000. Browse `/exercises`, open any activity at `/learn/<id>`, and start building as a guest. Sign in to save to an account, draft code with AI, run code in the sandbox, join a class, or share a blueprint.

## What it does

- **25 activities on one engine.** Money, numbers, lists, and text, from "naira to dollars" to "is the list sorted". Every activity is data in `src/lib/challenges.ts`: mission, offered blocks, an oracle, sample cases, seeded verification inputs, a reference blueprint, and a common mistake. The interpreter in `src/lib/blueprint.ts` runs them all.
- **A blueprint canvas.** Drag typed blocks (memory, loop, compare, accumulate, math, transform, return, and more), connect yes/no paths, edit numbers in the inspector, undo and redo.
- **Simulation you can see.** A packet strip shows the input with the current item lifted and memory, total, and count updating. Blocks light up as the packet moves, loops show their pass count and progress ring, and the forty verification inputs fill in as a grid of dots. Step, scrub, pause at breakpoints, run to a block, and predict branches.
- **Guidance without answers.** Repair previews, "show me why" explanations, a memory demonstration, and one-click previews of a working idea and a common mistake. Previews never overwrite your canvas until you apply them.
- **Code, when the idea works.** AI drafts code from your exact blocks, streams it into the editor, and it is only saved if it matches both the oracle and your blueprint on all forty inputs in an isolated sandbox. During playback the matching code lines highlight. Run tests checks any code you write yourself.
- **Guest mode.** Everything except AI, saving, classes, and sharing works without an account, with state kept in the browser. Signing in imports that work.
- **Classes and progress.** Instructors create private classes, set hint depth, require a correct prediction before drafting, pause drafting, review each student's journal across activities, and leave rubric feedback. Students see their story on `/progress` and can publish read-only replayable snapshots at `/share/<token>`.

## Configuration

Use `.env.local` (ignored by Git), following `.env.example`. Keep `OPENAI_API_KEY`, `SUPABASE_SECRET_KEY`, and `SUPABASE_ACCESS_TOKEN` out of browser code. The approved model and the budget limits it assumes live in `src/lib/ai-config.ts`; the SQL reservation function enforces them.

Apply migrations in order with `node scripts/migrate.cjs <file>`; the current chain ends at `202610090001_sharing.sql`. Email confirmation is required; auth email goes through Resend SMTP configured in Supabase (see `emails/auth/README.md`).

## Budget and limits

Each AI attempt reserves $0.01 in an atomic transaction against a $2 shared testing allowance, with 20 attempts per user per rolling day, a 10-second cooldown, and one active request per user. Failed attempts stay reserved. Sandbox runs are limited to 50 per user per day with a 10-second gap. Blueprints take up to 24 blocks; code up to 15 KB; each sandboxed test case gets 32 MB, a 150 ms deadline, and no access to modules, network, or the host. Passing finite samples is evidence, not a proof.

## Verify

```sh
npm run typecheck
npm run test:blueprint        # engine, 25 challenges, verification, guidance (no server needed)
npm run dev                   # then, in another shell:
npm run test:studio           # auth, persistence, sandbox run, share links
npm run test:teaching         # classes, sharing boundaries, predictions, policy
npm run test:production       # auth pages and route guards
npm run test:browser          # drives the real studio in the installed Chrome
npm run build && npm run start
```

`test:studio -- --live` adds two paid AI calls. The browser test writes screenshots to `infra/aws/private/screens/`. Integration scripts create and remove their own confirmed test accounts.

## Deploy

The site runs on one EC2 host behind Caddy; see `infra/aws/HOSTING.md`. Push to GitHub `main`, apply any new migration, then `node scripts/deploy-web.cjs --update`. No AWS resources are used at runtime; the former Fargate runner has been retired.

See `STUDIO.md` for how the studio and the engine work, and `EXERCISES.md` for adding an activity. `PLAN.md` records the October 2026 upgrade.
