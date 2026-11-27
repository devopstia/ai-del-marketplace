# The Terraform MCP server: an AI agent that reads the registry  [new, proposed: AI]

HashiCorp's Terraform MCP server (GA; v1.4.1 released 2026-10-23) gives an AI agent tools to search providers and
modules in the Terraform Registry and read their documentation, so it writes code against the **current** provider
schema instead of its memory. With an HCP Terraform token it can also list workspaces and runs.

## Safe set-up for the lesson
- Start with the `registry` toolset only (public docs, no token): `mcp.json.example` (Claude Code: `.mcp.json`;
  VS Code: `.vscode/mcp.json` with the same server block under `servers`).
- HCP Terraform tools: a **read-only team token** for a training organisation, passed as an environment variable,
  never in the file. Destructive operations stay disabled (they need an explicit opt-in setting; leave it off).
- Check the current flags and tool names in the official reference before recording:
  https://developer.hashicorp.com/terraform/mcp-server/reference

## Demo
1. Ask the agent: "Which arguments does aws_s3vectors_index need in the current AWS provider?" → it calls the
   registry tools and quotes the docs (compare with an agent without MCP that guesses).
2. Ask it to draft a module using the latest `terraform-aws-modules/vpc/aws` version → it looks the version up.
3. Run fmt/validate/plan yourself. The agent never runs `apply`.

## Cost
$0 (Docker image, public registry). HCP Terraform part: free tier of a training organisation.

## Clean up
`docker image rm hashicorp/terraform-mcp-server:1.4.1`; revoke the HCP Terraform token if you created one.
