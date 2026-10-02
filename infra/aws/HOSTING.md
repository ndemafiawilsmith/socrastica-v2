# EC2 hosting for socrastica.com

Target account: `954633149655`; region: `us-east-1`; local AWS CLI profile: `socrastica`.

The host is one Ubuntu 24.04 `t3.small`, with 20 GB encrypted gp3 storage, 2 GB disk swap, one Elastic IP, basic monitoring, IMDSv2 required, and CPU credits in Standard mode. Expected fixed hosting cost is approximately $21/month at 730 hours before tax, credits, transfer, and variable execution costs. This is an estimate, not an enforceable account spending cap. Existing servers for other projects are outside this estimate. There is no hosting load balancer, NAT gateway, or RDS database.

## Initial setup

Attach `ec2-deployment-iam.json` as an additional inline policy named `SocrasticaEC2Deployment` on `socrastica-deployer`. Keep existing PowerUserAccess and SocrasticaDeploymentIAM. The extra policy allows only the project instance profile and passing the web role to EC2. The web role remains constrained by SocrasticaRuntimeBoundary and the narrower `web-role-policy.json`.

```powershell
node scripts/provision-web.cjs
node scripts/provision-web.cjs --attach-role
node scripts/deploy-web.cjs
node scripts/configure-production-auth.cjs
```

The provisioner reuses the tagged project instance and Elastic IP. Do not run it to replace a terminated instance without reviewing its fixed initial client token and the resource inventory. `hosting-resources.json` stores local host IDs. `private/` contains the SSH private key and known-hosts file; both locations are ignored by Git. Back up the private key securely. Do not share it or commit it.

The host bootstraps Node 22 from the official archive with SHA-256 verification, Caddy, Git, bounded journals, and swap. Initial cloud-init completion takes a few minutes. The app is a separate unprivileged systemd service listening only on `127.0.0.1:3000`. SSH is allowed only from the deployment operator's IP; ports 80/443 are public. If your IP changes, replace the security group's existing SSH /32 rule with the new /32 before connecting. Never open SSH to the whole internet.

Application secrets are transferred over SSH into `/etc/socrastica/app.env` with `root:socrastica` ownership and mode 640. Only required app variables are transferred. The host does not receive the local AWS profile, AWS access keys, Supabase management token, or SMTP/Resend credentials. AWS execution access comes from its limited EC2 role. Auth emails continue through Supabase's configured Resend SMTP.

## Cloudflare and HTTPS

In Cloudflare DNS, set:

| Type | Name | Target | Initial proxy setting |
| --- | --- | --- | --- |
| A | @ | IP from hosting-resources.json | DNS only |
| CNAME | www | socrastica.com | DNS only |

Remove or replace conflicting website A/AAAA/CNAME records for these two names, while retaining email MX, SPF, DKIM, and other service records. Caddy automatically obtains and renews certificates after DNS resolves to this server. `www` redirects to the canonical apex domain. Direct HTTP requests to the IP can preview the landing page; use the HTTPS domain for login and learning.

Once `https://socrastica.com` responds correctly:

```powershell
node scripts/configure-production-auth.cjs --activate
```

This verifies the HTTPS host marker before changing Supabase's site URL; it retains existing callback allowlist entries and adds production confirmation/recovery callbacks. Then Cloudflare proxying can be enabled on the two website records, with SSL/TLS set to **Full (strict)**. Do not enable Flexible mode. Avoid cache rules that cache authenticated pages, `/api/*`, or `/auth/*`.

## Deploy subsequent GitHub updates

Push tested changes to GitHub `main`, then run locally:

```powershell
node scripts/deploy-web.cjs --update
```

Or connect using the ignored private key and run `sudo socrastica-deploy` on the server. The root-owned helper fetches GitHub `main`, creates a separate release, installs the lockfile dependencies, builds, switches the current symlink, restarts the app, and checks `/login`. A failed startup restores the prior release when one exists. Releases are bounded, retaining the newest two and rollback target. Deployments are manual; a GitHub push alone does not publish an update. No GitHub credentials are needed to fetch the public repository.

`node scripts/deploy-web.cjs` reapplies host service/Caddy configuration and the current local application environment, then deploys GitHub main. Use this full command after changing hosting configuration or secrets. Database migrations are separate; review and run them deliberately before deploying code that requires them.

## Operations

```sh
sudo systemctl status socrastica caddy
sudo journalctl -u socrastica -n 50 --no-pager
sudo journalctl -u caddy -n 50 --no-pager
free -m
df -h /
```

Journals are capped at 100 MB with seven-day retention. This is a single-server deployment: updates briefly restart the app, and there is no high-availability failover. Supabase stores user data; replacing EC2 does not replace the database. Check AWS Billing and configure cost alerts for the account, since traffic, existing projects, taxes, and other usage can exceed the hosting estimate.

Sources: [EC2 T3 pricing](https://aws.amazon.com/ec2/instance-types/t3/), [public IPv4 pricing](https://aws.amazon.com/vpc/pricing/), [EBS pricing](https://aws.amazon.com/ebs/pricing/), [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https), [Cloudflare Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/).
