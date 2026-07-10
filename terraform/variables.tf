variable "resource_group_name" {
  default = "bqpulse-rg"
}

variable "location" {
  default = "centralindia"
}

variable "acr_name" {
  default = "bqpulseacrnisha"
}

variable "container_app_env_name" {
  default = "bqpulse-env"
}

variable "container_app_name" {
  default = "bqpulse-app"
}

variable "cosmos_endpoint" {
  description = "Cosmos DB endpoint URL"
  type        = string
  sensitive   = true
}

variable "cosmos_key" {
  description = "Cosmos DB primary key"
  type        = string
  sensitive   = true
}