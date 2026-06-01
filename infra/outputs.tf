output "ec2_public_ip" {
  value       = aws_eip.app.public_ip
  description = "Stable Elastic IP of the EC2 instance (use this as EC2_HOST)."
}

output "ec2_public_dns" {
  value       = aws_eip.app.public_dns
  description = "Public DNS of the Elastic IP."
}

output "instance_id" {
  value       = aws_instance.app.id
  description = "EC2 instance ID (SSM Run Command / Session Manager target)."
}

output "github_actions_role_arn" {
  value       = aws_iam_role.github_deploy.arn
  description = "Set this as the GitHub repo variable AWS_ROLE_ARN."
}

output "ssm_session_command" {
  value       = "aws ssm start-session --target ${aws_instance.app.id} --region ${var.region}"
  description = "Break-glass shell access via SSM Session Manager (no SSH, no port 22)."
}

output "rds_endpoint" {
  value       = aws_db_instance.main.endpoint
  description = "RDS endpoint (host:port)."
}

output "rds_address" {
  value       = aws_db_instance.main.address
  description = "RDS hostname."
}

output "database_url" {
  value       = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.main.address}:5432/${var.db_name}"
  description = "DATABASE_URL to put in the EC2 deploy/.env."
  sensitive   = true
}
