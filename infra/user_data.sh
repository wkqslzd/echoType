#!/bin/bash
set -euxo pipefail

# Amazon Linux 2023 (ARM64). Install Docker engine, git, and the docker compose plugin.
dnf update -y
dnf install -y docker git

systemctl enable --now docker
usermod -aG docker ec2-user

# docker compose v2 plugin (aarch64 for Graviton)
COMPOSE_VERSION="v2.32.4"
mkdir -p /usr/local/lib/docker/cli-plugins
curl -fsSL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-aarch64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

echo "user_data provisioning complete" > /var/log/echotype-userdata.done
