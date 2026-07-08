# Single distribution, two origins:
#   default /*    -> S3 (static SPA, private via OAC)
#   /api/*        -> EC2 backend over HTTP (server-to-server, no mixed content)
# Result: one HTTPS origin for browser => no CORS, no mixed content.

data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

resource "aws_cloudfront_origin_access_control" "web" {
  name                              = "${var.project}-web-oac"
  description                       = "OAC for the EchoType frontend S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "web" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.project} frontend + /api proxy"
  default_root_object = "index.html"
  price_class         = "PriceClass_100"
  aliases             = [var.custom_domain]

  depends_on = [aws_acm_certificate_validation.web]

  # Origin A: private S3 bucket (frontend), read via OAC.
  origin {
    origin_id                = "s3-web"
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  # Origin B: EC2 backend (API) over HTTP. Use the EIP's stable public DNS name
  # (CloudFront origins must be domain names, not raw IPs).
  origin {
    origin_id   = "ec2-api"
    domain_name = aws_eip.app.public_dns

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Default: serve the SPA from S3.
  default_cache_behavior {
    target_origin_id       = "s3-web"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = data.aws_cloudfront_cache_policy.optimized.id
    compress               = true
  }

  # /api/* -> EC2 backend, never cached, forward everything (incl. POST bodies).
  ordered_cache_behavior {
    path_pattern             = "/api/*"
    target_origin_id         = "ec2-api"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
    compress                 = true
  }

  # SPA fallback: client-side routes (e.g. /courses/:id/type) must return index.html.
  # S3 returns 403 for missing keys when access is via OAC, so map both.
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # Custom domain HTTPS (ACM us-east-1). Default *.cloudfront.net still works with the AWS cert.
  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.web.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = {
    Name = "${var.project}-cdn"
  }
}
