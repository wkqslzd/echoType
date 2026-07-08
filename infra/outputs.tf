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

output "cloudfront_url" {
  value       = "https://${aws_cloudfront_distribution.web.domain_name}"
  description = "CloudFront default domain (still valid after custom domain; useful for transition/debug)."
}

output "site_url" {
  value       = local.web_origin
  description = "Canonical public site URL (frontend + /api)."
}

output "cloudfront_domain_name" {
  value       = aws_cloudfront_distribution.web.domain_name
  description = "CloudFront distribution domain name."
}

output "cloudfront_distribution_id" {
  value       = aws_cloudfront_distribution.web.id
  description = "Set as GitHub repo variable CF_DISTRIBUTION_ID."
}

output "web_bucket_name" {
  value       = aws_s3_bucket.web.bucket
  description = "Set as GitHub repo variable WEB_BUCKET."
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

output "cognito_user_pool_id" {
  value       = aws_cognito_user_pool.main.id
  description = "Cognito User Pool ID (also in SSM /echotype/COGNITO_USER_POOL_ID)."
}

output "cognito_client_id" {
  value       = aws_cognito_user_pool_client.web.id
  description = "Cognito SPA app client ID (also in SSM /echotype/COGNITO_CLIENT_ID)."
}

output "cognito_region" {
  value       = var.region
  description = "Region of the Cognito User Pool (also in SSM /echotype/COGNITO_REGION)."
}

output "acm_certificate_arn" {
  value       = aws_acm_certificate.web.arn
  description = "ACM certificate ARN (us-east-1) attached to CloudFront."
}

output "acm_validation_records" {
  value = {
    for dvo in aws_acm_certificate.web.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }
  description = "DNS validation CNAMEs to add in Porkbun (Phase 1.1). Not the apex ALIAS traffic record."
}
