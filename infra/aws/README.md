# AWS access bootstrap

Target account: `954633149655`. Region: `us-east-1`. CLI profile: `socrastica`.
Always supply this named profile. Do not use the unrelated default account.

An administrator in the target account must:

1. In IAM > Policies > Create policy > JSON, paste `runtime-boundary.json` and save as `SocrasticaRuntimeBoundary`. Do not attach it to the deployment user: it is the ceiling on future workload roles, not a deployment permission policy.
2. Create another policy from `deployer-iam.json`, named `SocrasticaDeploymentIAM`.
3. Attach `SocrasticaDeploymentIAM` to `socrastica-deployer` or its deployment group, alongside the existing `PowerUserAccess` policy.

The deployment policy requires the specified boundary when creating roles and does not permit changing/removing that boundary or modifying its policy. Ensure any preexisting roles named `socrastica-*` also carry this boundary before delegating management. The broad existing PowerUserAccess remains broad across non-IAM services; these files do not narrow it to project resources.

The boundary grants nothing on its own. Each role also needs a minimal actual permissions policy. Student execution roles must not receive application secret access merely because the boundary permits it for other workload roles. No developer credentials, OpenAI key, or Supabase secret should enter a student task.

The initial ceiling supports ECR pulls, bounded logs, project S3 objects, ECS task launch/status/stop, and project secret/parameter reads. New runtime capabilities (for example SES, custom KMS encryption, or Lambda invocation) require reviewing and updating the boundary with an administrator.

Access verification completed: the named profile authenticated to the target account, read ECS/VPC/ECR resources, read the installed runtime boundary, and created `socrastica-task-execution` with that boundary and the AWS-managed `AmazonECSTaskExecutionRolePolicy`. The Linux Docker engine is running. A runner image, ECS cluster/task definition, private S3 execution bucket, security group, and short-retention log groups have been provisioned. Actual role passing/task launch and result upload were verified by a real TypeScript submission. No always-running application hosting service, NAT gateway, or load balancer has been created.

## Rebuild and provision

```powershell
npm --prefix runner ci
npm run test:runner
docker build --platform linux/amd64 -t socrastica-runner:testing runner
npm run aws:provision
Compress-Archive -LiteralPath infra/aws/watchdog.cjs -DestinationPath infra/aws/watchdog.zip -Force
node scripts/provision-watchdog.cjs
```

The provisioning script checks the AWS account before mutations and requires a default VPC/subnet with an internet gateway. It creates no inbound runner access and HTTPS-only outbound access for the trusted coordinator; student QuickJS code has no network bridge. Images use immutable tags and task definitions pin the image digest. The generated `.env.local` settings contain resource IDs and a profile name, not AWS secret keys. Review `execution-resources.json` for the deployed resource inventory.

The independent watchdog is a Lambda function invoked by an EventBridge scheduled rule every minute. It reads only watchdog manifests, describes/stops overdue project tasks, and deletes handled records. It has no application secrets. The web server registers a cleanup record after launch, and stops the task if that registration fails. The task also exits after work and has its own 45-second watchdog. AWS scheduling and control-plane operations have latency; this is a cost guardrail rather than a guaranteed hard spending ceiling. A rare lost RunTask response can leave a task without a cleanup record; its own watchdog still applies once the container starts. Configure AWS cost alerts and operational monitoring before public launch.

Verify with `npm run test:execution` against a running production server (default test URL `http://127.0.0.1:3001`; override via EXECUTION_TEST_URL) and `node scripts/test-watchdog.cjs`. Both create short-lived, billable Fargate tasks. Test accounts are removed; execution budget reservations remain counted. The watchdog test deliberately launches a harmless persistent task and verifies that independent AWS cleanup stops it.

Website hosting is deployed separately on EC2 with Caddy HTTPS. See `HOSTING.md` for provisioning, Cloudflare, instance-profile permissions, and manual GitHub updates. The web role permits only project ECS launch/status/stop, relevant object access, and passing the task execution role; its EC2 instance-profile attachment currently awaits the additional deployment IAM permission. Production omits local AWS_PROFILE. Developer credentials and migration tokens are not copied to the host. Configure account cost alerts before broader launch.
