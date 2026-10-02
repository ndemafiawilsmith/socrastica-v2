#!/bin/bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get -o DPkg::Lock::Timeout=180 update
apt-get -o DPkg::Lock::Timeout=180 install -y ca-certificates curl git xz-utils caddy

# Verify the official Node archive before installing it.
work=$(mktemp -d)
cd "$work"
curl --fail --silent --show-error --location https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt -o SHASUMS256.txt
archive=$(awk '$2 ~ /^node-v22\.[0-9]+\.[0-9]+-linux-x64\.tar\.xz$/ {print $2}' SHASUMS256.txt)
test -n "$archive"
curl --fail --silent --show-error --location "https://nodejs.org/dist/latest-v22.x/$archive" -o "$archive"
grep "  $archive$" SHASUMS256.txt | sha256sum --check --status
install -d /usr/local/lib/nodejs
tar -xJf "$archive" -C /usr/local/lib/nodejs
node_dir="/usr/local/lib/nodejs/${archive%.tar.xz}"
for executable in node npm npx; do ln -sfn "$node_dir/bin/$executable" "/usr/local/bin/$executable"; done
cd /
rm -rf -- "$work"

if ! id socrastica >/dev/null 2>&1; then useradd --system --create-home --home-dir /opt/socrastica --shell /usr/sbin/nologin socrastica; fi
install -d -o socrastica -g socrastica /opt/socrastica/releases
install -d -o root -g socrastica -m 750 /etc/socrastica
if ! swapon --show | grep -q /swapfile; then
  if [ ! -e /swapfile ]; then fallocate -l 2G /swapfile; chmod 600 /swapfile; mkswap /swapfile; fi
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
cat > /etc/systemd/journald.conf.d-socrastica-tmp <<'EOF'
[Journal]
SystemMaxUse=100M
MaxRetentionSec=7day
EOF
install -d /etc/systemd/journald.conf.d
mv /etc/systemd/journald.conf.d-socrastica-tmp /etc/systemd/journald.conf.d/socrastica.conf
systemctl restart systemd-journald
touch /var/lib/socrastica-bootstrap-ready
