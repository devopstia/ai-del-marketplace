variable "region" {
  description = "A region where Bedrock Knowledge Bases and S3 Vectors are available."
  type        = string
  default     = "us-east-1"
}

variable "name_prefix" {
  type    = string
  default = "del-training"
}

variable "embedding_model_id" {
  description = "Embedding model (enable access to it in the Bedrock console first)."
  type        = string
  default     = "amazon.titan-embed-text-v2:0"
}

variable "embedding_dimension" {
  description = "Must match the embedding model (Titan Text Embeddings v2: 1024, 512 or 256)."
  type        = number
  default     = 1024
  validation {
    condition     = contains([256, 512, 1024], var.embedding_dimension)
    error_message = "Titan v2 supports 256, 512 or 1024."
  }
}
