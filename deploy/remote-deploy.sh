#!/usr/bin/env bash
# Runs ON the EC2 instance, invoked by SSM Run Command (as root).
# The workflow has already checked out the target commit before calling this.
# It reads DATABASE_URL from SSM Parameter Store, writes deploy/.env, and
# (re)builds + starts the API container. No secrets are passed over the wire.
#
# Usage: bash deploy/remote-deploy.sh <aws-region> <public-ip>
set -euo pipefail

REGION="${1:?usage: remote-deploy.sh <aws-region> <public-ip>}"
PUBLIC_IP="${2:?usage: remote-deploy.sh <aws-region> <public-ip>}"

# Resolve repo root from this script's location (deploy/ -> repo root).
cd "$(dirname "$0")/.."

# AWS CLI ships with AL2023, but self-heal in case this is an older instance.
command -v aws >/dev/null 2>&1 || dnf install -y awscli

DB_URL="$(aws ssm get-parameter \
  --name "/echotype/DATABASE_URL" \
  --with-decryption \
  --region "$REGION" \
  --query 'Parameter.Value' \
  --output text)"

cat > deploy/.env <<ENV
DATABASE_URL=${DB_URL}
DEMO_USER_ID=demo-user
API_PORT=3001
WEB_ORIGIN=http://${PUBLIC_IP}
ENV

docker compose -f deploy/docker-compose.cloud.yml --env-file deploy/.env up -d --build
docker image prune -f
