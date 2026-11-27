# AI prompts for Terraform  [new, proposed: AI]

Prompt files used in the AI module of both Terraform masterclasses (AWS and Azure: swap the provider details).
They build on the prompt engineering lessons (CR-077–CR-082) instead of repeating them.

| File | Lesson |
|---|---|
| `01-write-hcl-professional.md` | Prompting AI to write HCL: poor vs professional prompt, proved with fmt/validate/Checkov/plan |
| `02-explain-plan.md` | AI explains a plan and errors, including a case where it is wrong |
| `03-review-pr-plan.md` | AI review comment on a pull request's plan in GitHub Actions; a person approves |
| `04-write-tests.md` | AI writes `terraform test` cases; mutation check before keeping them |

**The rule for every lesson:** AI drafts, Terraform and a person verify. Never auto-apply AI output; never paste
secrets, state files or credentials into a chat.
