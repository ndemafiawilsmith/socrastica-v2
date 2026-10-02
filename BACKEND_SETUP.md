# Backend status and remaining setup

Updated October 2, 2026.

## Connected and verified

Supabase migration `202610010001_learning.sql` is published. `learning_sessions`, `ai_budget`, and `ai_requests` have row-level security enabled. Authenticated users can read their own session; writes run through server routes that verify identity and ownership. Budget tables and the reservation function are inaccessible to ordinary users.

Email/password auth, confirmation callback, reset-password screens, protected routes, cookie refresh, progress persistence, and a live Socratic mentor are implemented. Integration checks verified sign-in/out, saved progress, account isolation, payload/origin validation, atomic budget exhaustion, cooldown, daily limits, and one live response with saved conversation. Temporary test accounts were removed.

## OpenAI budget configuration

`OPENAI_MODEL=gpt-6-luna` is saved in `.env.local`. The app refuses a different model until the budget configuration is deliberately reviewed. Mentoring uses bounded recent history and reasoning notes, no reasoning tokens or tools, 1,000 output tokens, a 30-second provider timeout, and no automatic retries.

The database reserves $0.01 per attempted request, counting failures too. A $2 total reservation allowance and 20 attempts/user/day protect the $3 testing budget. The response is now validated JSON with a reply, cumulative reasoning notes, readiness decision, and an optional graph, capped at 1,000 output tokens. Reservations remain conservative and exceed expected token charges at the documented model prices. Account-wide costs from unrelated use are not controlled by this application.

Run `npm run usage:status` for aggregate attempts, reservations, and an estimate based on recorded tokens. Provider billing is authoritative. Do not automatically reset counters or increase the limit during testing.

## Auth email delivery

Resend SMTP is configured and authentication verified (`smtp.resend.com`, TLS port 465, username `resend`). The local RESEND_API_KEY is the SMTP password; it is never printed or included in app source. Sender: `accounts@socrastica.com`, name: Socrastica. Six responsive branded auth templates are published in Supabase and verified against saved configuration. Email confirmation remains required. The key is sending-only, so domain inspection through Resend's API is forbidden; ensure the sender domain is marked verified in Resend. SMTP authentication/configuration does not prove inbox delivery. See `emails/auth/README.md` for previews and delivery checks.

Run `npm run auth:email` to republish SMTP configuration and templates from the local environment. This authenticates against Resend SMTP without sending an email. Never share secrets in chat. Confirm domain verification in Resend and test an actual confirmation or recovery email before public launch.

The current local callback allowlist includes `http://localhost:3000/auth/callback` and its password-recovery variant. PKCE confirmation/recovery links should be opened in the browser that initiated the request. Before deploying, register equivalent production URLs and set the production site URL in Supabase.

## AWS execution backend

E2B is replaced by ECS Fargate in account `954633149655`, region `us-east-1`. `scripts/provision-execution.cjs` uploads the runner image to ECR and configures private S3 storage, an ECS cluster/task definition, a security group with no inbound traffic, and bounded logs. Resource settings are in `.env.local` and `infra/aws/execution-resources.json`. No always-running application service or NAT gateway is provisioned.

`POST /api/execute` verifies auth/origin/payload, atomically reserves an execution slot, stores the input privately, and launches one task. `GET /api/execute?id=...` verifies ownership and persists results. The task receives only short-lived signed URLs for its own input and output; it has no task IAM role. Student TypeScript is transpiled and executed inside QuickJS/WebAssembly, with 32 MB VM memory, a 750 ms deadline per case, fresh test contexts, and no host functions or module loader. These exercises support standalone synchronous functions, not arbitrary Node projects. The trusted host validates primitive boolean returns against eight reviewed cases.

The 200-run shared allowance is intentionally conservative. Each user may attempt 20 runs per rolling day; at most four jobs can be active. Failed attempts remain counted. A 45-second runner watchdog and a separate EventBridge/Lambda cleanup job stop overdue tasks even when browsers disconnect. Task startup and AWS control-plane transitions add latency; execution tests alone do not prove flowchart equivalence or complexity. Production monitoring/alerts, broader challenge coverage, inbox delivery checks, and security review remain before a broader public launch.

Verified: runner tests, execution quota guards in rolled-back SQL transactions, real authenticated Fargate execution with all eight cases passing, persisted results, cross-user denial/RLS, normal successful task shutdown, and an independent Lambda cleanup test against an overdue running task. Production build, typecheck, existing auth/progress integration, auth-page/stylesheet checks, and npm audit passed. These tests made no OpenAI calls. Temporary test accounts were removed; execution reservations remain counted.

## Website hosting

The website is deployed on a single Ubuntu EC2 t3.small in the project AWS account, with encrypted 20 GB gp3 storage, Standard CPU credits, and one Elastic IP. Caddy HTTPS is verified at https://socrastica.com; www redirects to the apex. Production Supabase confirmation/recovery callbacks and the site URL are configured. Hosted pages, stylesheets, authentication, persistence, origin guards, and one live budget-approved AI response with automatic map progression passed. Temporary test accounts were removed.

The EC2 application role is created with the runtime boundary and narrow execution policy, but attaching its instance profile is pending the additional SocrasticaEC2Deployment permission. The hosted code runner is unavailable until that permission is attached, the role is associated, and a hosted execution test passes. See `infra/aws/ec2-deployment-iam.json` and `infra/aws/HOSTING.md`. Local runner verification remains valid but does not establish hosted role access.

GitHub main is fetched by a manual deployment helper that builds separate releases, switches the live symlink, restarts the app, checks health, and restores the previous release on a failed startup. No developer AWS credentials or management tokens were copied to the host. Estimated fixed hosting is about $21/month before tax, credits, transfer, and execution usage; other projects and account-wide usage are outside that estimate.

## Further product work

- Expand the reasoning/graph assessment beyond duplicate detection; current graphs are generated from the student's accepted reasoning.
- Expand the reviewed challenge library and progress across challenges; the current runner grades duplicate detection only.
- Add account deletion, data retention, backup/restore procedures, and production monitoring.
- Complete the EC2 execution role attachment and hosted runner verification; enable Cloudflare proxying with Full (strict) SSL if desired.
- Configure OAuth or payments only if those features are requested.

## Secrets

`.env.local` is ignored; `.env.example` is safe to share. The public Supabase URL and publishable key belong in browser configuration. OpenAI, the server database key, SMTP secrets, and the Supabase management token stay server-side. AWS developer credentials remain in the local named CLI profile and never enter the Docker image. `SUPABASE_ACCESS_TOKEN` is migration-only and is not referenced by app routes.

## Sources

- https://developers.openai.com/api/docs/models/gpt-6-luna
- https://supabase.com/docs/guides/auth/server-side/creating-a-client
- https://supabase.com/docs/guides/auth/auth-smtp
- https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-task-networking.html
- https://github.com/justjake/quickjs-emscripten
