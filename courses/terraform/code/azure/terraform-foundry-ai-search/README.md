# Terraform for AI infrastructure on Azure: Foundry + Azure AI Search  [Azure mirror, new: AI]

Azure counterpart of `../../terraform-bedrock-knowledge-base`. Terraform builds the platform: a Foundry resource
(AIServices with projects), a Foundry project, chat and embedding deployments, Azure AI Search (Free tier), a private
Storage container for the runbooks, and Entra ID role assignments (no API keys anywhere).

Ingestion (the index, data source, skillset and indexer that chunk and embed the documents) is data-plane: the lesson
creates it with the portal's "Import and vectorize data" wizard or the REST API, then shows the result in Foundry's
playground ("add your data"). Terraform does not manage the index in this lab.

## Steps
```bash
az login && cp terraform.tfvars.example terraform.tfvars
terraform init && terraform apply
az storage blob upload-batch --account-name $(terraform output -raw storage_account) -d runbooks -s docs --auth-mode login
```
Then the import wizard on the Search service (embedding deployment `text-embedding-3-small`), and a question in the
Foundry playground: "The disk is full on a server. What should I never delete?"
Model names and versions change: check the Foundry model catalogue in your region before recording.

## Cost (estimate 2026-11-27; check before recording)
Under $0.50 per run: Search **Free** tier $0 (one per subscription), pay-per-token deployments (cents), Storage (cents).
`search_sku = "basic"` costs about $75/month: never without the owner's OK, destroy the same day.

## Clean up (always)
`terraform destroy`; the AIServices account is soft-deleted: purge it with
`az cognitiveservices account purge -n <name> -g rg-del-training-foundry -l eastus` (or keep the provider default,
which purges on destroy). Check `az group exists -n rg-del-training-foundry` → false.
