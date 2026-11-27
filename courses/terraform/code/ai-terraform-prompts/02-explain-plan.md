# Prompt: explain a plan or an error

```
You are reviewing a Terraform plan before it is applied to <environment>.
Here is the output of `terraform show -no-color plan.out` (secrets are redacted):
<paste>

1. Summarise in plain words what will be created, changed, replaced and destroyed (counts first).
2. List every replace or destroy, why Terraform wants it (the attribute that forces it), and the risk.
3. Anything that could cause downtime, data loss, extra cost or a security change.
4. What you are not sure about. Do not guess attribute meanings: say "check the provider docs for X".
```
Error variant: paste the full error and the block it points to; ask for the cause, the fix, and how to confirm it.
Always confirm the answer against the plan itself and the provider documentation: AI can be wrong (the video shows a
case where it is).
