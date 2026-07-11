# PreSignUp Lambda: reject native Cognito SignUp when email already exists
# (including Google federated users). ExternalProvider triggers are allowed
# so email-first → Google L2 linking in the API is unchanged.
#
# Apply order (single terraform apply; graph enforces):
#   1) IAM role/policy for Lambda (no pool ARN ref — avoids cycle)
#   2) Lambda function
#   3) User pool update (lambda_config.pre_sign_up → function ARN)
#   4) aws_lambda_permission (Cognito invoke; after pool exists)

data "archive_file" "cognito_presignup" {
  type        = "zip"
  source_file = "${path.module}/lambda/cognito_presignup/handler.py"
  output_path = "${path.module}/.build/cognito_presignup.zip"
}

data "aws_iam_policy_document" "cognito_presignup_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "cognito_presignup" {
  name               = "${var.project}-cognito-presignup"
  description        = "PreSignUp Lambda: ListUsers to block duplicate email SignUp."
  assume_role_policy = data.aws_iam_policy_document.cognito_presignup_assume.json
}

data "aws_iam_policy_document" "cognito_presignup" {
  statement {
    sid    = "ListUsersInAccountPools"
    effect = "Allow"
    actions = ["cognito-idp:ListUsers"]
    # Avoid referencing aws_cognito_user_pool.main.arn here — that would cycle with
    # pool.lambda_config → this Lambda. Scope is still this account/region's pools.
    resources = [
      "arn:aws:cognito-idp:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:userpool/*",
    ]
  }

  statement {
    sid       = "CloudWatchLogs"
    effect    = "Allow"
    actions   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${var.project}-cognito-presignup*"]
  }
}

resource "aws_iam_role_policy" "cognito_presignup" {
  name   = "${var.project}-cognito-presignup"
  role   = aws_iam_role.cognito_presignup.id
  policy = data.aws_iam_policy_document.cognito_presignup.json
}

resource "aws_lambda_function" "cognito_presignup" {
  function_name = "${var.project}-cognito-presignup"
  description   = "Block native SignUp when email already exists (Google or Cognito)."
  role          = aws_iam_role.cognito_presignup.arn
  handler       = "handler.handler"
  runtime       = "python3.12"
  timeout       = 10

  filename         = data.archive_file.cognito_presignup.output_path
  source_code_hash = data.archive_file.cognito_presignup.output_base64sha256

  # userPoolId comes from the Cognito event; do not reference the pool id here
  # (would create a Terraform cycle with lambda_config on the pool).

  depends_on = [aws_iam_role_policy.cognito_presignup]
}

resource "aws_lambda_permission" "cognito_presignup" {
  statement_id  = "AllowCognitoInvokePreSignUp"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cognito_presignup.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}
