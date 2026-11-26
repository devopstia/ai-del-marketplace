# ---------------- lesson video delivery: CloudFront in front of the media buckets (owner 2026-11-26, option A) ----------------
# Only encrypted HLS segments (hls/*) are served, and only with a CloudFront signed policy the API issues per playback
# session (apps/api/src/protection/cdn-signer.ts). The private key is in SSM /del-marketplace/<stack>/CDN_PRIVATE_KEY_B64
# (created with the AWS CLI, never in git or state); its public half is keys/cdn-media-2026-11.pub.pem.
# No geographic restriction: the marketplace is global, Africa included (AGENTS rule 23). docs/VIDEO_DELIVERY.md.
resource "aws_cloudfront_public_key" "media" {
  name        = "${local.name}-media-2026-11"
  comment     = "signs lesson video segment links"
  encoded_key = file("${path.module}/keys/cdn-media-2026-11.pub.pem")
}
resource "aws_cloudfront_key_group" "media" {
  name  = "${local.name}-media"
  items = [aws_cloudfront_public_key.media.id]
}
resource "aws_cloudfront_origin_access_control" "media" {
  for_each                          = local.stacks
  name                              = "${local.name}-${each.key}-media"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}
data "aws_cloudfront_cache_policy" "optimized" { name = "Managed-CachingOptimized" }
data "aws_cloudfront_origin_request_policy" "cors_s3" { name = "Managed-CORS-S3Origin" }
data "aws_cloudfront_response_headers_policy" "cors" { name = "Managed-SimpleCORS" }

resource "aws_cloudfront_distribution" "media" {
  for_each     = local.stacks
  enabled      = true
  comment      = "${local.name} ${each.key} lesson video"
  price_class  = "PriceClass_All" # every edge location, including Lagos, Nairobi, Johannesburg and Cape Town
  http_version = "http2and3"
  origin {
    domain_name              = aws_s3_bucket.media[each.key].bucket_regional_domain_name
    origin_id                = "media"
    origin_access_control_id = aws_cloudfront_origin_access_control.media[each.key].id
  }
  default_cache_behavior {
    target_origin_id           = "media"
    viewer_protocol_policy     = "https-only"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = false # segments are encrypted video
    cache_policy_id            = data.aws_cloudfront_cache_policy.optimized.id
    origin_request_policy_id   = data.aws_cloudfront_origin_request_policy.cors_s3.id
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.cors.id
    trusted_key_groups         = [aws_cloudfront_key_group.media.id]
  }
  restrictions {
    geo_restriction { restriction_type = "none" }
  }
  viewer_certificate { cloudfront_default_certificate = true }
}

# CloudFront (this distribution only) may read the encrypted segments; everything else in the bucket stays private.
resource "aws_s3_bucket_policy" "media_cdn" {
  for_each = aws_s3_bucket.media
  bucket   = each.value.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "CloudFrontReadsVideoSegments"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${each.value.arn}/hls/*"
      Condition = { StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.media[each.key].arn } }
    }]
  })
}
