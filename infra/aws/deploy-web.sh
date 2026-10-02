#!/bin/bash
# Installed root-owned as /usr/local/bin/socrastica-deploy. Run with sudo.
set -euo pipefail
test "$(id -u)" = 0 || { echo 'Run sudo socrastica-deploy'; exit 1; }
exec 9>/var/lock/socrastica-deploy.lock
flock -n 9 || { echo 'Another deployment is running'; exit 1; }
repo=/opt/socrastica/repo.git
if [ ! -d "$repo" ]; then
  runuser -u socrastica -- git clone --bare https://github.com/ndemafiawilsmith/socrastica-v2.git "$repo"
fi
runuser -u socrastica -- git --git-dir="$repo" fetch origin refs/heads/main:refs/heads/main
requested="${1:-refs/heads/main}"
if [ "$requested" != refs/heads/main ] && ! [[ "$requested" =~ ^[a-f0-9]{40}$ ]]; then
  echo 'Specify a full commit SHA or omit it to deploy GitHub main'; exit 1
fi
revision=$(runuser -u socrastica -- git --git-dir="$repo" rev-parse "$requested^{commit}")
release="/opt/socrastica/releases/$(date -u +%Y%m%dT%H%M%SZ)-${revision:0:12}"
install -d -o socrastica -g socrastica "$release"
runuser -u socrastica -- git --git-dir="$repo" archive "$revision" | tar -x -C "$release"
chown -R socrastica:socrastica "$release"
ln -s /etc/socrastica/app.env "$release/.env.local"
runuser -u socrastica -- env NEXT_TELEMETRY_DISABLED=1 npm --prefix "$release" ci --no-audit --no-fund
cd "$release"
runuser -u socrastica -- env NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=1280 npm run build
previous=$(readlink -f /opt/socrastica/current || true)
ln -sfn "$release" /opt/socrastica/current
systemctl restart socrastica
healthy=false
for attempt in $(seq 1 30); do
  if curl --fail --silent --output /dev/null http://127.0.0.1:3000/login; then healthy=true; break; fi
  sleep 2
done
if [ "$healthy" != true ]; then
  if [ -n "$previous" ] && [ -d "$previous" ]; then ln -sfn "$previous" /opt/socrastica/current; systemctl restart socrastica; fi
  echo 'Deployment failed its health check; previous release restored when available.'
  exit 1
fi
echo "Deployed $revision"
# Retain the newest two releases and the rollback target, within the fixed release directory.
mapfile -t releases < <(find /opt/socrastica/releases -mindepth 1 -maxdepth 1 -type d | sort -r)
for old in "${releases[@]:2}"; do
  if [ "$old" != "$previous" ] && [ "$old" != "$release" ]; then rm -rf -- "$old"; fi
done
