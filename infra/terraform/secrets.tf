# ---------------- application settings and secrets (SSM Parameter Store, SecureString) ----------------
# The server reads /del-marketplace/<stack>/* at each release into a root-only .env. Nothing secret is in git,
# images or workflows. Stripe keys are entered later by a super admin in Payments & Stripe (stored encrypted in
# the database); live payments stay off until the owner authorises them.
resource "random_password" "session" {
  for_each = local.stacks
  length   = 64
  special  = false
}
resource "random_password" "seed" {
  length  = 24
  special = false
}
resource "random_password" "seed_mfa" {
  # base32 (A-Z only is a valid subset) for the staging demo accounts' authenticator
  length  = 32
  upper   = true
  lower   = false
  numeric = false
  special = false
}

locals {
  seed_mfa = random_password.seed_mfa.result
  db_host  = aws_db_instance.db.address
  common = {
    REGION                = var.region
    S3_REGION             = var.region
    ECR_REGISTRY          = "${local.account}.dkr.ecr.${var.region}.amazonaws.com"
    ACME_EMAIL            = var.acme_email
    EMAIL_PROVIDER        = "ses"
    EMAIL_FROM            = "DevOps Easy Learning <no-reply@${var.domain}>"
    EMAIL_REPLY_TO        = "support@devopseasylearning.com"
    CONTACT_EMAIL         = "support@devopseasylearning.com"
    VIDEO_PROVIDER        = "local"
    PROTECTED_PLAYBACK    = "true"
    MFA_REQUIRED          = "true"
    DATABASE_SSL          = "rds"
    OAUTH_TEST_PROVIDER   = "false"
    PASSWORD_BREACH_CHECK = "true"
    AUTH_RATE_LIMIT       = "20"
  }
  per_stack = {
    production = merge(local.common, {
      DEPLOY_ENV        = "production"
      PUBLIC_HOST       = var.domain
      WEB_URL           = "https://${var.domain}"
      API_URL           = "https://${var.domain}"
      DATABASE_URL      = "postgresql://delmarket:${random_password.db.result}@${local.db_host}:5432/marketplace"
      SESSION_SECRET    = random_password.session["production"].result
      S3_BUCKET         = aws_s3_bucket.media["production"].bucket
      DEV_TEST_PAYMENTS = "false"
      CDN_URL           = "https://${aws_cloudfront_distribution.media["production"].domain_name}"
      CDN_KEY_PAIR_ID   = aws_cloudfront_public_key.media.id
    })
    staging = merge(local.common, {
      DEPLOY_ENV        = "staging"
      PUBLIC_HOST       = var.staging_host
      WEB_URL           = "https://${var.staging_host}"
      API_URL           = "https://${var.staging_host}"
      DATABASE_URL      = "postgresql://delmarket:${random_password.db.result}@${local.db_host}:5432/marketplace_staging"
      SESSION_SECRET    = random_password.session["staging"].result
      S3_BUCKET         = aws_s3_bucket.media["staging"].bucket
      DEV_TEST_PAYMENTS = "true"
      CDN_URL           = "https://${aws_cloudfront_distribution.media["staging"].domain_name}"
      CDN_KEY_PAIR_ID   = aws_cloudfront_public_key.media.id
      SEED_PASSWORD     = random_password.seed.result
      SEED_MFA_SECRET   = local.seed_mfa
      AUTH_RATE_LIMIT   = "300"
    })
  }
  params = merge([for stack, kv in local.per_stack : { for k, v in kv : "${stack}/${k}" => v }]...)
}

resource "aws_ssm_parameter" "app" {
  for_each = local.params
  name     = "/${local.name}/${each.key}"
  type     = "SecureString"
  value    = each.value
}
