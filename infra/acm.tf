# Custom domain Phase 1.1: ACM in us-east-1 (required for CloudFront).
# DNS validation records are added manually in Porkbun; see output acm_validation_records.
#
# Apply order (3A):
#   1. terraform apply -target=aws_acm_certificate.web
#   2. Add validation CNAMEs in Porkbun; wait until ISSUED
#   3. terraform apply   # validation + CloudFront alias + SSM + Cognito

resource "aws_acm_certificate" "web" {
  provider = aws.us_east_1

  domain_name               = var.custom_domain
  subject_alternative_names = ["*.${var.custom_domain}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${var.project}-web-cert"
  }
}

# Polls until Porkbun validation CNAMEs propagate and ACM marks the cert ISSUED.
resource "aws_acm_certificate_validation" "web" {
  provider = aws.us_east_1

  certificate_arn = aws_acm_certificate.web.arn

  timeouts {
    create = "45m"
  }
}
