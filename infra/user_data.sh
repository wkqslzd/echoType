#!/bin/bash
set -euxo pipefail

# Amazon Linux 2023 (ARM64). Install Docker engine, git, and the docker compose plugin.
dnf update -y
dnf install -y docker git

systemctl enable --now docker
usermod -aG docker ec2-user

# SSM agent + AWS CLI ship with Amazon Linux 2023; ensure they are present/running
# (guarded so a missing unit/package never fails cloud-init).
systemctl enable --now amazon-ssm-agent || true
command -v aws >/dev/null 2>&1 || dnf install -y awscli || true

# docker compose v2 plugin (aarch64 for Graviton)
COMPOSE_VERSION="v2.32.4"
mkdir -p /usr/local/lib/docker/cli-plugins
curl -fsSL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-aarch64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

echo "user_data provisioning complete" > /var/log/echotype-userdata.done
