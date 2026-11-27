output "knowledge_base_id" {
  value = aws_bedrockagent_knowledge_base.this.id
}

output "data_source_id" {
  value = aws_bedrockagent_data_source.runbooks.data_source_id
}

output "guardrail_id" {
  value = aws_bedrock_guardrail.this.guardrail_id
}

output "sync_command" {
  description = "Ingest the documents (Terraform creates the pipeline; ingestion is a run, not a resource)."
  value       = "aws bedrock-agent start-ingestion-job --knowledge-base-id ${aws_bedrockagent_knowledge_base.this.id} --data-source-id ${aws_bedrockagent_data_source.runbooks.data_source_id} --region ${var.region}"
}
