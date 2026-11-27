# New lesson (AI strand): Terraform for AI infrastructure on AWS.
# A RAG stack: documents in S3 -> Bedrock Knowledge Base (Titan embeddings) -> Amazon S3 Vectors index,
# plus a Bedrock Guardrail. The cheapest managed vector store; no OpenSearch Serverless (that has a monthly minimum).

terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.27" # S3 Vectors storage for knowledge bases needs >= 6.27
    }
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Course    = "terraform-aws-masterclass"
      Lesson    = "bedrock-knowledge-base"
      ManagedBy = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}

locals {
  account   = data.aws_caller_identity.current.account_id
  name      = "${var.name_prefix}-kb"
  embed_arn = "arn:${data.aws_partition.current.partition}:bedrock:${var.region}::foundation-model/${var.embedding_model_id}"
}

# ---------- documents ----------
resource "aws_s3_bucket" "docs" {
  bucket        = "${local.name}-docs-${local.account}"
  force_destroy = true # training: destroy removes the uploaded documents too
}

resource "aws_s3_bucket_public_access_block" "docs" {
  bucket                  = aws_s3_bucket.docs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_object" "runbooks" {
  for_each = fileset("${path.module}/docs", "*.md")
  bucket   = aws_s3_bucket.docs.id
  key      = "runbooks/${each.value}"
  source   = "${path.module}/docs/${each.value}"
  etag     = filemd5("${path.module}/docs/${each.value}")
}

# ---------- vector store ----------
resource "aws_s3vectors_vector_bucket" "this" {
  vector_bucket_name = "${local.name}-vectors-${local.account}"
  force_destroy      = true
}

resource "aws_s3vectors_index" "this" {
  vector_bucket_name = aws_s3vectors_vector_bucket.this.vector_bucket_name
  index_name         = "runbooks"
  data_type          = "float32"
  dimension          = var.embedding_dimension
  distance_metric    = "cosine"

  # Bedrock stores the chunk text and its metadata here; they must not be filterable keys.
  metadata_configuration {
    non_filterable_metadata_keys = ["AMAZON_BEDROCK_TEXT", "AMAZON_BEDROCK_METADATA"]
  }
}

# ---------- knowledge base role (least privilege) ----------
data "aws_iam_policy_document" "kb_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["bedrock.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [local.account]
    }
  }
}

resource "aws_iam_role" "kb" {
  name               = "${local.name}-role"
  assume_role_policy = data.aws_iam_policy_document.kb_trust.json
}

data "aws_iam_policy_document" "kb" {
  statement {
    sid       = "Embeddings"
    actions   = ["bedrock:InvokeModel"]
    resources = [local.embed_arn]
  }
  statement {
    sid       = "ReadDocuments"
    actions   = ["s3:GetObject", "s3:ListBucket"]
    resources = [aws_s3_bucket.docs.arn, "${aws_s3_bucket.docs.arn}/*"]
  }
  statement {
    sid       = "Vectors"
    actions   = ["s3vectors:PutVectors", "s3vectors:GetVectors", "s3vectors:DeleteVectors", "s3vectors:QueryVectors", "s3vectors:GetIndex"]
    resources = [aws_s3vectors_index.this.index_arn]
  }
}

resource "aws_iam_role_policy" "kb" {
  name   = "knowledge-base"
  role   = aws_iam_role.kb.id
  policy = data.aws_iam_policy_document.kb.json
}

# ---------- knowledge base ----------
resource "aws_bedrockagent_knowledge_base" "this" {
  name     = local.name
  role_arn = aws_iam_role.kb.arn

  knowledge_base_configuration {
    type = "VECTOR"
    vector_knowledge_base_configuration {
      embedding_model_arn = local.embed_arn
    }
  }

  storage_configuration {
    type = "S3_VECTORS"
    s3_vectors_configuration {
      index_arn = aws_s3vectors_index.this.index_arn
    }
  }

  depends_on = [aws_iam_role_policy.kb]
}

resource "aws_bedrockagent_data_source" "runbooks" {
  name              = "runbooks"
  knowledge_base_id = aws_bedrockagent_knowledge_base.this.id

  data_source_configuration {
    type = "S3"
    s3_configuration {
      bucket_arn         = aws_s3_bucket.docs.arn
      inclusion_prefixes = ["runbooks/"]
    }
  }
}

# ---------- guardrail ----------
resource "aws_bedrock_guardrail" "this" {
  name                      = "${local.name}-guardrail"
  blocked_input_messaging   = "Sorry, I can't help with that request."
  blocked_outputs_messaging = "Sorry, I can't share that answer."

  sensitive_information_policy_config {
    pii_entities_config {
      type   = "AWS_ACCESS_KEY"
      action = "BLOCK"
    }
    pii_entities_config {
      type   = "EMAIL"
      action = "ANONYMIZE"
    }
  }

  topic_policy_config {
    topics_config {
      name       = "destructive-commands"
      type       = "DENY"
      definition = "Requests to delete production data, disable security controls or run destructive commands without approval."
      examples   = ["Give me a command to delete every S3 bucket in production"]
    }
  }
}
