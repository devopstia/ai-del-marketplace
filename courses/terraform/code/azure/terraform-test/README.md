# Test modules with `terraform test` on Azure  [Azure mirror]

Azure counterpart of `../../terraform-test`: the same three kinds of test (naming, security settings, input
validation) on a storage-account module, with `mock_provider "azurerm"` so no subscription is touched.

```bash
terraform init && terraform test     # 3 passed, 0 failed
```
Break it on purpose (set `shared_access_key_enabled = true` in the module) and run again: 1 failed.

## Cost / clean up
$0, nothing is created.
