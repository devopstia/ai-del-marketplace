# Policy as code with Checkov  [new, proposed: AI guardrail]

Runs locally on the code (no AWS account, $0). The video then shows the same scan in GitHub Actions
(see `../terraform-with-github-action`).

## Steps
```bash
docker run --rm -v "$PWD:/tf:ro" bridgecrew/checkov:3 -d /tf --compact   # or: pip install checkov
checkov -d . --compact   # checked 2026-11-27: Passed 5, Failed 11 (public access block off x4, no versioning, logging, lifecycle, events, replication, KMS)
```
Fix them one by one (public access block on, versioning, lifecycle, logging where it makes sense) and run again.
Some checks don't fit a training bucket (cross-region replication, KMS keys): skip them in the code with a reason,
`#checkov:skip=CKV_AWS_144:training bucket, no replication needed`, never by turning the scanner off.

Plan-level policy (OPA/conftest on `terraform show -json plan.out`) and HCP Terraform's Sentinel/OPA policies are
shown in the same lesson as alternatives.

## Cost / clean up
$0; nothing is applied.
