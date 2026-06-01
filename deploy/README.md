# EchoType — Cloud walking skeleton (manual deploy)

Terraform provisions EC2 + RDS; the backend runs with docker compose against RDS.
Automated deploys go through GitHub Actions (OIDC + SSM, no SSH — see the CI/CD
section). The steps below are the equivalent **manual** path for debugging.

## 0. Provision infra (from your laptop)

```bash
cd infra
terraform init
terraform apply        # creates VPC, subnets, SGs, EC2 (t4g.micro), RDS (db.t4g.micro)
```

Grab the outputs:

```bash
terraform output ec2_public_ip            # the stable Elastic IP
terraform output instance_id              # SSM target
terraform output github_actions_role_arn  # -> GitHub repo variable AWS_ROLE_ARN
terraform output ssm_session_command      # break-glass shell (no SSH)
terraform output -raw database_url        # sensitive; also stored in SSM Parameter Store
```

> RDS takes ~5–10 min to become available. EC2 `user_data` also needs ~1–2 min
> after boot to finish installing Docker + the compose plugin.

## 1. Shell into EC2 (SSM Session Manager — no SSH, no port 22)

Port 22 is closed entirely. Open a shell via Systems Manager (requires the AWS
CLI Session Manager plugin installed locally):

```bash
aws ssm start-session --target <INSTANCE_ID> --region ap-southeast-2
# or just: $(terraform -chdir=infra output -raw ssm_session_command)
```

Verify Docker is ready (user_data writes a marker when done):

```bash
cat /var/log/echotype-userdata.done   # "user_data provisioning complete"
docker --version && docker compose version
```

If the marker is missing, wait a bit and re-check (cloud-init still running).

## 2. Clone the repo on EC2

```bash
git clone https://github.com/wkqslzd/echoType.git
cd echoType
```

## 3. Create the deploy env file

```bash
cp deploy/.env.example deploy/.env
nano deploy/.env
```

Set `DATABASE_URL` to the value from `terraform output -raw database_url` (the
same value is stored as a SecureString at SSM parameter `/echotype/DATABASE_URL`,
which is what CI reads automatically), e.g.:

```
DATABASE_URL=postgresql://echotype:<password>@echotype-db.xxxx.ap-southeast-2.rds.amazonaws.com:5432/echotype
DEMO_USER_ID=demo-user
API_PORT=3001
WEB_ORIGIN=http://<EC2_PUBLIC_IP>
```

## 4. Build and run the backend

```bash
docker compose -f deploy/docker-compose.cloud.yml --env-file deploy/.env up -d --build
```

On first start the container runs `prisma migrate deploy` + seed, then starts the
API on container port 3001, published on host port **80**.

Watch logs:

```bash
docker compose -f deploy/docker-compose.cloud.yml logs -f api
```

## 5. Verify from your laptop (public IP)

```bash
curl http://<EC2_PUBLIC_IP>/health
curl http://<EC2_PUBLIC_IP>/courses | jq
```

`/courses` should return the two seeded courses (Stray Birds 49, What I Have Lived For).

## Notes / gotchas

- **Security group**: there is **no port 22 ingress** at all. HTTP (80) is open
  to the world (`0.0.0.0/0`) so the public backend is reachable. Shell access is
  via SSM Session Manager (agent-initiated outbound 443), so nothing inbound is
  exposed besides 80.
- **RDS is private**: no public access. Only the EC2 SG can reach 5432.
- **ARM image**: EC2 is Graviton (arm64); Docker pulls arm64 images automatically.
- **Elastic IP**: the instance has a stable EIP, so its public address survives
  rebuilds / re-applies. Use `terraform output ec2_public_ip` as `EC2_HOST`.
- **Tear down** to avoid charges: `cd infra && terraform destroy`.

## CI/CD (GitHub Actions, OIDC + SSM — no SSH)

`.github/workflows/deploy.yml` deploys on **manual trigger only**
(`workflow_dispatch`). Flow:

1. **OIDC**: the runner assumes `${var.project}-github-deploy` via
   `aws-actions/configure-aws-credentials` — short-lived creds, no stored keys.
2. **Resolve**: `ec2:DescribeInstances` finds the running `echotype-app`
   instance and its public IP.
3. **Deploy**: `ssm:SendCommand` (`AWS-RunShellScript`) tells the instance to
   `git checkout` the pushed commit and run `deploy/remote-deploy.sh`, which
   reads `DATABASE_URL` from SSM Parameter Store, writes `deploy/.env`, and runs
   `docker compose ... up -d --build` (**build on EC2**). The job polls the
   command to completion and prints its stdout/stderr.
4. **Health check**: polls `http://<public-ip>/health`. Fail = fail, no rollback.

Terraform is **never** run in CI — infra is applied locally by the maintainer.

**No SSH key and no DB credentials are stored in GitHub.** Required config
(Settings → Secrets and variables → Actions):

| Kind | Name | Source |
|---|---|---|
| Variable | `AWS_ROLE_ARN` | `terraform output -raw github_actions_role_arn` |

The IAM deploy role is least-privilege: `ec2:DescribeInstances`,
`ssm:SendCommand` (only to `Project=echotype` instances + the
`AWS-RunShellScript` document), and reading command results. The EC2 instance
profile grants only SSM managed access + reading `/echotype/*` parameters.

## Future upgrades (TODO, not in MVP)

- **Migrate to GHCR push/pull images**: build the API image on the GitHub runner,
  push to GitHub Container Registry (GHCR), and have EC2 pull the prebuilt image
  instead of building on the t4g.micro. Removes build load from the instance.
- **Tighten OIDC trust**: scope the role's `sub` condition from `repo:…:*` to a
  specific branch/environment (e.g. `repo:wkqslzd/echoType:ref:refs/heads/main`).
