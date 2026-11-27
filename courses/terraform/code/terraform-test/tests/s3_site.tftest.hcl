# Runs with no AWS account: the provider is mocked, so `terraform test` is free and fast.
mock_provider "aws" {}

run "names_the_bucket_after_the_environment" {
  command = plan

  assert {
    condition     = module.site.bucket_name == "dev-help-site"
    error_message = "Expected dev-help-site, got ${module.site.bucket_name}."
  }
}

run "blocks_public_access" {
  command = apply # applies against the mock, nothing is created

  module {
    source = "./modules/s3-site"
  }

  variables {
    name        = "reports"
    environment = "prod"
  }

  assert {
    condition     = aws_s3_bucket_public_access_block.this.block_public_policy && aws_s3_bucket_public_access_block.this.restrict_public_buckets
    error_message = "The bucket must block public policies."
  }

  assert {
    condition     = aws_s3_bucket_versioning.this.versioning_configuration[0].status == "Enabled"
    error_message = "Versioning must be on by default."
  }
}

run "rejects_bad_names" {
  command = plan

  module {
    source = "./modules/s3-site"
  }

  variables {
    name        = "Bad_Name"
    environment = "dev"
  }

  expect_failures = [var.name]
}
