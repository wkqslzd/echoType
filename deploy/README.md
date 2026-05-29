# EchoType — Cloud walking skeleton (manual deploy)

This is the **manual** path: Terraform provisions EC2 + RDS, then you SSH in and
run the backend with docker compose against RDS. No GitHub Actions yet.

## 0. Provision infra (from your laptop)

```bash
cd infra
terraform init
terraform apply        # creates VPC, subnets, SGs, EC2 (t4g.micro), RDS (db.t4g.micro)
```

Grab the outputs:

```bash
terraform output ec2_public_ip
terraform output ssh_command
terraform output -raw database_url   # sensitive: postgresql://echotype:...@<rds>:5432/echotype
```

> RDS takes ~5–10 min to become available. EC2 `user_data` also needs ~1–2 min
> after boot to finish installing Docker + the compose plugin.

## 1. SSH into EC2

```bash
ssh -i ~/.ssh/echotype_ec2 ec2-user@<EC2_PUBLIC_IP>
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

Set `DATABASE_URL` to the value from `terraform output -raw database_url`, e.g.:

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

- **Security group**: ports 22 and 80 are open to your home IP only
  (`my_ip_cidr`). If your home IP changes, update `my_ip_cidr` in
  `infra/terraform.tfvars` and `terraform apply` again.
- **RDS is private**: no public access. Only the EC2 SG can reach 5432.
- **ARM image**: EC2 is Graviton (arm64); Docker pulls arm64 images automatically.
- **Tear down** to avoid charges: `cd infra && terraform destroy`.
