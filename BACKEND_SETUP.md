# Backend status and remaining setup

Updated October 13, 2026.

## Connected and verified

Supabase migrations through `202610090001_sharing.sql` are applied. `learning_sessions` holds one row per (user, challenge); `studio_events` is the journal; `classrooms`, `classroom_members`, and `classroom_feedback` hold teaching data; `blueprint_shares` holds public snapshots; `ai_budget`, `ai_requests`, and `exercise_run_requests` hold the AI and sandbox quotas. Row-level security allows owner reads; every write goes through server routes and service-role SQL functions that check ownership and revisions.

Email/password auth with confirmation, password reset, protected routes, and cookie refresh are implemented. Auth email goes through Resend SMTP configured in Supabase (sender `accounts@socrastica.com`); see `emails/auth/README.md`.

## OpenAI budget

`OPENAI_MODEL` must equal the approved model in `src/lib/ai-config.ts`; the app refuses other models until the budget is reviewed. The database reserves $0.01 per attempted request against a $2 allowance, with 20 attempts per user per rolling day, a 10-second cooldown, and one active request per user. Run `npm run usage:status` for aggregates; provider billing is authoritative.

## Code execution

Code runs inside the web server in isolated QuickJS runtimes (`src/lib/sandbox.ts`): 32 MB memory, 512 KB stack, 150 ms per case within a 4-second total, no modules, no network, no host access. Sandbox runs are limited to 50 per user per rolling day with a 10-second gap. The former ECS Fargate runner, its watchdog, bucket, repository, roles, and log groups were torn down on October 13, 2026; nothing in the account is used at runtime. The legacy `execution_jobs` and `execution_budget` tables and the old `messages`/`reasoning_*` columns on `learning_sessions` remain in the database unused; dropping them is a separate deliberate cleanup.

## Website hosting

One Ubuntu EC2 `t3.small` with Caddy HTTPS serves https://socrastica.com. The host needs no AWS role. Deploy with `node scripts/deploy-web.cjs --update` after pushing to GitHub `main` and applying any new migration; see `infra/aws/HOSTING.md`.

## Further product work

- Python support through a Pyodide sandbox adapter.
- Account deletion, data retention, backup and restore procedures, production monitoring, and cost alerts.
- Broader challenge authoring, including instructor-defined activities.

## Secrets

`.env.local` is ignored; `.env.example` is safe to share. The public Supabase URL and publishable key belong in browser configuration. OpenAI, the server database key, SMTP secrets, and the Supabase management token stay server-side. The AWS CLI profile `socrastica` is used only by local hosting scripts.
