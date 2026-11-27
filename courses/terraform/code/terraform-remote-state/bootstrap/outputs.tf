output "state_bucket" {
  description = "Put this name in app/backend.hcl."
  value       = aws_s3_bucket.state.bucket
}

output "region" {
  value = var.region
}
