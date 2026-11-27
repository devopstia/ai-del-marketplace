# No Azure subscription needed: the provider is mocked.
mock_provider "azurerm" {}

run "names_the_account_after_the_environment" {
  command = plan
  assert {
    condition     = module.storage.account_name == "stdevhelpsite"
    error_message = "Expected stdevhelpsite, got ${module.storage.account_name}."
  }
}

run "keeps_the_account_private" {
  command = apply
  module {
    source = "./modules/storage"
  }
  variables {
    name                = "reports"
    environment         = "prod"
    resource_group_name = "rg-test"
  }
  assert {
    condition     = azurerm_storage_account.this.allow_nested_items_to_be_public == false && azurerm_storage_account.this.shared_access_key_enabled == false
    error_message = "The account must be private and keyless."
  }
  assert {
    condition     = azurerm_storage_account.this.min_tls_version == "TLS1_2"
    error_message = "TLS 1.2 minimum."
  }
}

run "rejects_bad_names" {
  command = plan
  module {
    source = "./modules/storage"
  }
  variables {
    name                = "bad-name"
    environment         = "dev"
    resource_group_name = "rg-test"
  }
  expect_failures = [var.name]
}
