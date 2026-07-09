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
terraform output ec2_public_ip             # the stable Elastic IP
terraform output instance_id               # SSM target
terraform output github_actions_role_arn   # -> GitHub repo variable AWS_ROLE_ARN
terraform output cloudfront_url            # public site URL (frontend + /api)
terraform output web_bucket_name           # -> GitHub repo variable WEB_BUCKET
terraform output cloudfront_distribution_id # -> GitHub repo variable CF_DISTRIBUTION_ID
terraform output ssm_session_command       # break-glass shell (no SSH)
terraform output -raw database_url         # sensitive; also stored in SSM Parameter Store
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
git clone https://github.com/dennycgan/echoType.git
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
API_PORT=3001
WEB_ORIGIN=https://<CLOUDFRONT_DOMAIN>
```

> CI reads `WEB_ORIGIN` automatically from SSM parameter `/echotype/WEB_ORIGIN`
> (set by Terraform to the CloudFront URL); you only set it by hand for a manual run.

## 4. Build and run the backend

```bash
docker compose -f deploy/docker-compose.cloud.yml --env-file deploy/.env up -d --build
```

On first start the container runs `prisma migrate deploy`, then starts the
API on container port 3001, published on host port **80**. Production does not
run the dev seed (`SEED_ENV=dev` only).

Watch logs:

```bash
docker compose -f deploy/docker-compose.cloud.yml logs -f api
```

## 5. Verify

The backend's port 80 is locked to CloudFront, so you do **not** curl the EC2 IP
from your laptop. Two valid ways to test:

- **Public (through CloudFront)** — the real path browsers use:

```bash
curl https://<CLOUDFRONT_DOMAIN>/api/health      # {"ok":true,...}
curl https://<CLOUDFRONT_DOMAIN>/api/courses | jq # seeded courses
```

- **Direct on the instance (debugging)** — open an SSM session, then hit the
  container locally:

```bash
aws ssm start-session --target <INSTANCE_ID> --region ap-southeast-2
# inside the instance:
curl http://localhost/api/health
curl http://localhost/api/courses
```

`/api/courses` should return the two seeded courses (Stray Birds 49, What I Have
Lived For).

## Notes / gotchas

- **Security group**: there is **no port 22 ingress** at all, and **port 80 is
  restricted to CloudFront's origin-facing ranges** (AWS managed prefix list
  `com.amazonaws.global.cloudfront.origin-facing`). The backend is therefore only
  reachable *through* CloudFront, never via plain public HTTP. Shell access is via
  SSM Session Manager (agent-initiated outbound 443).
- **API path prefix**: all backend routes are under `/api` (`/api/health`,
  `/api/courses`, `/api/sessions`) so a single CloudFront behavior `/api/*` routes
  to EC2 while everything else serves the SPA from S3.
- **No CORS / no mixed content**: the browser only talks HTTPS to the one
  CloudFront domain (frontend and `/api` are same-origin). CloudFront → EC2 is
  server-to-server over HTTP. `WEB_ORIGIN` is set to the CloudFront URL (via SSM
  parameter `/echotype/WEB_ORIGIN`) as a CORS safety net for POSTs.
- **Frontend bucket is private**: S3 has Block Public Access on; only CloudFront
  reads it via Origin Access Control (OAC).
- **RDS is private**: no public access. Only the EC2 SG can reach 5432.
- **ARM image**: EC2 is Graviton (arm64); Docker pulls arm64 images automatically.
- **Elastic IP**: the instance has a stable EIP; CloudFront uses its public DNS
  name as the API origin.
- **Tear down** to avoid charges: `cd infra && terraform destroy`.

## CI/CD (GitHub Actions, OIDC — no SSH)

Two **manual-trigger** (`workflow_dispatch`) workflows, both assuming the same
OIDC role (`echotype-github-deploy`); no stored keys, no DB credentials in GitHub.

**`deploy.yml` — backend (EC2 via SSM):**
1. **OIDC**: assume the role via `aws-actions/configure-aws-credentials`.
2. **Resolve**: `ec2:DescribeInstances` finds the running `echotype-app` instance.
3. **Deploy**: `ssm:SendCommand` (`AWS-RunShellScript`) tells the instance to
   `git checkout` the pushed commit and run `deploy/remote-deploy.sh`, which reads
   `DATABASE_URL` + `WEB_ORIGIN` from SSM Parameter Store, writes `deploy/.env`,
   and runs `docker compose ... up -d --build` (**build on EC2**).
4. **Health check**: polls `https://<cloudfront>/api/health` (read from the
   `/echotype/WEB_ORIGIN` parameter). Fail = fail, no rollback.

**`deploy-web.yml` — frontend (S3 + CloudFront):**
1. `pnpm install` + `pnpm --filter @echotype/web build` (output `apps/web/dist`).
2. **OIDC**: assume the role.
3. `aws s3 sync apps/web/dist s3://<bucket> --delete`.
4. `aws cloudfront create-invalidation --paths "/*"`.

Terraform is **never** run in CI — infra is applied locally by the maintainer.

Required config (Settings → Secrets and variables → Actions → **Variables**):

| Name | Source |
|---|---|
| `AWS_ROLE_ARN` | `terraform output -raw github_actions_role_arn` |
| `WEB_BUCKET` | `terraform output -raw web_bucket_name` |
| `CF_DISTRIBUTION_ID` | `terraform output -raw cloudfront_distribution_id` |

The deploy role is least-privilege: `ec2:DescribeInstances`; `ssm:SendCommand`
(only `Project=echotype` instances + `AWS-RunShellScript`); read command results;
read the `WEB_ORIGIN` param; `s3:PutObject/DeleteObject/ListBucket` on the web
bucket; `cloudfront:CreateInvalidation` on the distribution.

## First-time deploy order (frontend + backend)

Run these **in order** the first time (and any time CloudFront/S3 are recreated):

1. **`terraform apply`** (local) — creates S3 + CloudFront + the `WEB_ORIGIN`
   parameter + IAM/SG changes.
2. **Wait for CloudFront** to finish deploying: status `Deployed` (~10–15 min;
   check AWS Console → CloudFront, or
   `aws cloudfront get-distribution --id <ID> --query 'Distribution.Status'`).
   Until then the public URL (and the backend health check through it) will fail.
3. **Set GitHub Variables**: `AWS_ROLE_ARN`, `WEB_BUCKET`, `CF_DISTRIBUTION_ID`
   (from the matching `terraform output`s).
4. **Run `deploy.yml`** (backend) — so the API picks up the updated `WEB_ORIGIN`
   (the CloudFront URL) and is reachable via `/api/*`.
5. **Run `deploy-web.yml`** (frontend) — uploads the SPA and invalidates the cache.
6. **Verify on phone (4G)**: open `https://<CLOUDFRONT_DOMAIN>` — UI loads, list
   courses, type, and a session persists (all HTTPS, same-origin).

> Steps 4 and 5 are independent afterwards: a frontend-only change just needs
> `deploy-web.yml`; a backend-only change just needs `deploy.yml`.

## Future upgrades (TODO, not in MVP)

- **Migrate to GHCR push/pull images**: build the API image on the GitHub runner,
  push to GitHub Container Registry (GHCR), and have EC2 pull the prebuilt image
  instead of building on the t4g.micro. Removes build load from the instance.
- **Tighten OIDC trust**: scope the role's `sub` condition from `repo:…:*` to a
  specific branch/environment (e.g. `repo:dennycgan/echoType:ref:refs/heads/main`).
