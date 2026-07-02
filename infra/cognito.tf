# Auth Phase 1: Cognito User Pool + SPA app client.
# Callback path /auth/callback is a placeholder until Auth Phase 4; adjust here + re-apply if routes change.
# Email: COGNITO_DEFAULT (50/day AWS cap) — sufficient for MVP; switch to SES if volume hits the limit.
# prevent_user_existence_errors LEGACY (Phase 5.1): client returns UserNotFoundException
# so the app can tell users when no account exists for an email (ENABLED masks it).

locals {
  web_origin = "https://${aws_cloudfront_distribution.web.domain_name}"

  cognito_callback_urls = [
    "${local.web_origin}/auth/callback",
    "${var.dev_web_origin}/auth/callback",
  ]

  cognito_logout_urls = [
    "${local.web_origin}/",
    "${var.dev_web_origin}/",
  ]
}

resource "aws_cognito_user_pool" "main" {
  name = "${var.project}-users"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = false
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
  }

  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  tags = {
    Name    = "${var.project}-user-pool"
    Project = var.project
  }
}

resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.project}-web"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    # IAM-only AdminInitiateAuth (local probe / maintainer CLI); not callable from browser.
    "ALLOW_ADMIN_USER_PASSWORD_AUTH",
  ]

  access_token_validity  = 1
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "hours"
    refresh_token = "days"
  }

  callback_urls = local.cognito_callback_urls
  logout_urls   = local.cognito_logout_urls

  supported_identity_providers = ["COGNITO"]

  prevent_user_existence_errors = "LEGACY"

  read_attributes = [
    "email",
    "email_verified",
    "name",
  ]

  write_attributes = [
    "email",
    "name",
  ]
}
