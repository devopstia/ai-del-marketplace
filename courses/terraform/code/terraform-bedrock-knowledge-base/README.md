# Terraform for AI infrastructure: a Bedrock RAG stack  [new, proposed: AI]

Documents in S3 → Bedrock Knowledge Base (Titan Text Embeddings v2) → Amazon S3 Vectors, with a Bedrock Guardrail.
Links the AI masterclass's RAG module: there students *use* a knowledge base; here they *build* it as code.

## Before you start
- Bedrock console → Model access: enable **Titan Text Embeddings V2** and one chat model (e.g. Amazon Nova Micro).
- Terraform >= 1.11, AWS provider >= 6.27 (checked with 6.74.0 on 2026-11-27).

## Steps
```bash
cp terraform.tfvars.example terraform.tfvars
terraform init && terraform apply
$(terraform output -raw sync_command)          # ingest the two runbooks
aws bedrock-agent-runtime retrieve-and-generate --region us-east-1 \
  --input '{"text":"The disk is full on a server. What should I never delete?"}' \
  --retrieve-and-generate-configuration '{"type":"KNOWLEDGE_BASE","knowledgeBaseConfiguration":{"knowledgeBaseId":"'"$(terraform output -raw knowledge_base_id)"'","modelArn":"arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-micro-v1:0"}}'
```
The answer cites the runbook ("never delete database files"). Then show the guardrail in the Bedrock console's test
window with a destructive request.

## Cost (estimate, 2026-11-27 prices; check before recording)
Under $0.50 per run: a few KB of embeddings (fractions of a cent), S3 Vectors storage and queries (cents), a handful of
model calls (cents), guardrail checks (cents). Nothing runs by the hour. No OpenSearch Serverless.

## Clean up (always)
`terraform destroy` (both buckets have `force_destroy`). Check:
`aws bedrock-agent list-knowledge-bases --region us-east-1` and `aws s3vectors list-vector-buckets --region us-east-1`
show nothing from this lesson.
