# New lesson: refactor without destroying.
# Step 1 (before): the parameters were written as two separate resources:
#   resource "aws_ssm_parameter" "app_name" { ... }
#   resource "aws_ssm_parameter" "app_env"  { ... }
# Step 2 (now): one for_each resource. The moved blocks tell Terraform the objects are the same,
# so the plan shows "has moved to" instead of destroy + create.

locals {
  parameters = {
    name = "billing-api"
    env  = "dev"
  }
}

resource "aws_ssm_parameter" "app" {
  for_each = local.parameters
  name     = "/del-training/moved/${each.key}"
  type     = "String"
  value    = each.value
}

moved {
  from = aws_ssm_parameter.app_name
  to   = aws_ssm_parameter.app["name"]
}

moved {
  from = aws_ssm_parameter.app_env
  to   = aws_ssm_parameter.app["env"]
}

# Step 3: stop managing something without deleting it in AWS (Terraform >= 1.7).
# Uncomment after removing its resource block; `terraform apply` forgets it, the parameter stays in AWS.
# removed {
#   from = aws_ssm_parameter.legacy
#   lifecycle {
#     destroy = false
#   }
# }
