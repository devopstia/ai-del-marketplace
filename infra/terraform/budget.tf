# ---------------- cost alert (owner 2026-11-26) ----------------
# Counts only resources tagged App=del-marketplace (every resource here, via default_tags), so Insurance Hub costs in the
# same account are not included. Emails at 80% of the monthly amount (actual) and 100% (forecast).
# The tag must also be activated as a cost allocation tag (Billing › Cost allocation tags › App › Activate). AWS only
# accepts that once the tag appears in billing data (up to 24 h after resources are first tagged); until then this budget
# reports $0. Activation was attempted 2026-11-26 (too early): do it in the console or re-add
#   resource "aws_ce_cost_allocation_tag" "app" { tag_key = "App"  status = "Active" }
resource "aws_budgets_budget" "monthly" {
  name         = "${local.name}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  cost_filter {
    name   = "TagKeyValue"
    values = [format("user:App$%s", local.name)] # tag filter syntax: user:<key>$<value>
  }
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }
}
