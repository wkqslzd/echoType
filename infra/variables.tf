variable "project" {
  type        = string
  default     = "echotype"
  description = "Project name, used as a prefix and tag for all resources."
}

variable "region" {
  type        = string
  default     = "ap-southeast-2"
  description = "AWS region to deploy into."
}

variable "vpc_cidr" {
  type        = string
  default     = "10.0.0.0/16"
  description = "CIDR block for the VPC."
}

variable "public_subnet_cidr" {
  type        = string
  default     = "10.0.1.0/24"
  description = "CIDR block for the public subnet (hosts the EC2 instance)."
}

variable "private_subnet_cidrs" {
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24"]
  description = "CIDR blocks for the private subnets (RDS subnet group needs >= 2 AZs)."
}

variable "my_ip_cidr" {
  type        = string
  default     = ""
  description = "Retained for reference only. Port 22 is now closed entirely; access is via SSM Session Manager. No longer used by any resource."
}

variable "github_repo" {
  type        = string
  default     = "wkqslzd/echoType"
  description = "GitHub repo (owner/name) allowed to assume the deploy role via OIDC."
}

variable "public_key_path" {
  type        = string
  default     = "~/.ssh/echotype_ec2.pub"
  description = "Path to the SSH public key registered with the EC2 instance."
}

variable "instance_type" {
  type        = string
  default     = "t4g.micro"
  description = "EC2 instance type (ARM/Graviton, free-tier eligible)."
}

variable "db_instance_class" {
  type        = string
  default     = "db.t4g.micro"
  description = "RDS instance class (free-tier eligible)."
}

variable "db_engine_version" {
  type        = string
  default     = "16"
  description = "PostgreSQL major engine version for RDS."
}

variable "db_name" {
  type        = string
  default     = "echotype"
  description = "Initial database name created in RDS."
}

variable "db_username" {
  type        = string
  default     = "echotype"
  description = "Master username for RDS."
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "Master password for RDS. Provide via terraform.tfvars (gitignored)."
}

variable "dev_web_origin" {
  type        = string
  default     = "http://localhost:5173"
  description = "Local Vite dev origin; included in Cognito callback/logout URLs alongside WEB_ORIGIN."
}

variable "custom_domain" {
  type        = string
  default     = "echotype.ink"
  description = "Canonical public hostname (apex). ACM cert + CloudFront alternate domain name."
}
