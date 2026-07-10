data "azurerm_resource_group" "main" {
  name = var.resource_group_name
}

data "azurerm_container_registry" "acr" {
  name                = var.acr_name
  resource_group_name = var.resource_group_name
}

resource "azurerm_log_analytics_workspace" "logs" {
  name                = "bqpulse-logs"
  location            = data.azurerm_resource_group.main.location
  resource_group_name = data.azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days    = 30
}

resource "azurerm_container_app_environment" "env" {
  name                       = var.container_app_env_name
  location                   = data.azurerm_resource_group.main.location
  resource_group_name        = data.azurerm_resource_group.main.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.logs.id
}

resource "azurerm_user_assigned_identity" "aca_identity" {
  name                = "bqpulse-identity"
  location            = data.azurerm_resource_group.main.location
  resource_group_name = data.azurerm_resource_group.main.name
}

resource "azurerm_role_assignment" "acr_pull" {
  scope                = data.azurerm_container_registry.acr.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.aca_identity.principal_id
}

resource "azurerm_container_app" "app" {
  name                         = var.container_app_name
  container_app_environment_id = azurerm_container_app_environment.env.id
  resource_group_name          = data.azurerm_resource_group.main.name
  revision_mode                = "Single"

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.aca_identity.id]
  }

  registry {
    server   = data.azurerm_container_registry.acr.login_server
    identity = azurerm_user_assigned_identity.aca_identity.id
  }

  secret {
    name  = "cosmos-key"
    value = var.cosmos_key
  }

  template {
    min_replicas = 0
    max_replicas = 1

    container {
      name   = "bqpulse"
      image  = "${data.azurerm_container_registry.acr.login_server}/bqpulse:latest"
      cpu    = 0.25
      memory = "0.5Gi"

      env {
        name  = "COSMOS_ENDPOINT"
        value = var.cosmos_endpoint
      }

      env {
        name        = "COSMOS_KEY"
        secret_name = "cosmos-key"
      }

      env {
        name  = "COSMOS_DATABASE"
        value = "bqpulse"
      }

      env {
        name  = "COSMOS_CONTAINER"
        value = "starred"
      }
    }
  }

  ingress {
    external_enabled = true
    target_port      = 5000
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  depends_on = [azurerm_role_assignment.acr_pull]
}

output "app_url" {
  value = "https://${azurerm_container_app.app.latest_revision_fqdn}"
}