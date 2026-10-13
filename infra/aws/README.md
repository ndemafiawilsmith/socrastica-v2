# AWS

Target account: `954633149655`. Region: `us-east-1`. CLI profile: `socrastica`. Always supply this named profile; do not use the unrelated default account.

Only the website host remains in AWS: one EC2 instance with an Elastic IP and a security group, provisioned by `scripts/provision-web.cjs` and deployed by `scripts/deploy-web.cjs`. See `HOSTING.md`.

The execution backend (ECS Fargate cluster and task definition, ECR repository, execution S3 bucket, runner security group, watchdog Lambda and EventBridge rule, `socrastica-task-execution`, `socrastica-watchdog`, and `socrastica-web` roles, and the `/socrastica/*` log groups) was torn down on October 13, 2026. Code now runs in the web server's QuickJS sandbox. An empty `socrastica-web` instance profile may remain; the deployer user cannot view or delete it and it costs nothing.

`runtime-boundary.json` and `deployer-iam.json` describe the permissions boundary and the deployment policy installed in the account for future workload roles. The deployment user keeps `PowerUserAccess` plus `SocrasticaDeploymentIAM`.
