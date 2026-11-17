variable "project" {
  description = "Name prefix for every resource, and the ECR namespace (<registry>/<project>/<image>)."
  type        = string
  default     = "carrental"
}

variable "region" {
  description = "Paris is the closest region to Tunisia with the full service set."
  type        = string
  default     = "eu-west-3"
}

variable "domain" {
  description = "The apex domain. Route 53 hosts it; the web app lives at the apex (and www), carapi at api."
  type        = string
}

variable "acme_email" {
  description = "Let's Encrypt registers the certificates Caddy obtains to this address."
  type        = string
}

variable "instance_type" {
  description = "One instance runs the whole compose stack (Caddy, the api, its scheduler, the web app). t4g.small (2 vCPU, 2 GB, arm64) is about $14/month in Paris; the memory ceilings in compose.prod.yml sum to 1.2 GB."
  type        = string
  default     = "t4g.small"
}

variable "instance_architecture" {
  description = <<-EOT
    arm64 matches an Apple Silicon laptop, so images built locally (make release) run on the server
    unchanged, and the t4g family is the cheapest. amd64 (t3a.medium and the like) means every
    local build needs --platform linux/amd64, but GitHub-hosted x86 runners build for it natively.
    Must agree with instance_type.
  EOT
  type        = string
  default     = "arm64"

  validation {
    condition     = contains(["arm64", "amd64"], var.instance_architecture)
    error_message = "instance_architecture must be arm64 or amd64."
  }
}

variable "root_volume_gb" {
  description = "Root disk. Images, container logs and the api_files volume (photos, papers) live here."
  type        = number
  default     = 30
}

variable "ssh_public_key" {
  description = "Public key the server accepts for the ubuntu user (make sync, make remote-deploy, and debugging)."
  type        = string
}

variable "ssh_allowed_cidrs" {
  description = <<-EOT
    Where a plain ssh on port 22 may come from. Empty (the default) opens no port 22 at all: ssh
    goes through Session Manager instead (car-infra/ssh_config), which needs nothing open. Set
    to ["<your ip>/32"] only if you want plain ssh as well.
  EOT
  type        = list(string)
  default     = []
}

variable "instance_termination_protection" {
  description = "Refuses to terminate the instance (console, CLI, `tofu destroy`, `-replace`) while true. Its disk holds env/*.env and secrets/. To rebuild the server: set false, apply, then apply -replace."
  type        = bool
  default     = true
}

variable "db_instance_class" {
  description = "db.t4g.micro (2 vCPU burst, 1 GB) is about $16/month with storage; far more than a few agencies' contracts need."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "GB of gp3 storage. Autoscales up to max_allocated_storage in database.tf."
  type        = number
  default     = 20
}

variable "db_name" {
  type    = string
  default = "carrental"
}

variable "db_username" {
  type    = string
  default = "carrental"
}

variable "db_deletion_protection" {
  description = "Refuses `tofu destroy` while true. To tear down: set false, apply, then destroy (which still takes the final snapshot unless db_skip_final_snapshot is true)."
  type        = bool
  default     = true
}

variable "db_skip_final_snapshot" {
  description = "false keeps a final snapshot on destroy (production). Set true only for throwaway environments."
  type        = bool
  default     = false
}

variable "alert_email" {
  description = "Where CloudWatch alarms go (API down, instance status, CPU, RDS storage). Empty disables monitoring.tf entirely."
  type        = string
  default     = ""
}

variable "github_repositories" {
  description = "owner/name of every repo whose GitHub Actions may push images to ECR (carapi and carweb)."
  type        = list(string)
}

variable "github_allowed_refs" {
  description = <<-EOT
    Git refs from which those repositories' workflows may assume the ECR push role. The build
    workflows run on v* tags and on manual dispatch from a branch, hence both patterns. Narrowing
    to ["refs/tags/v*"] alone means a dispatched build from a branch can no longer push.
  EOT
  type        = list(string)
  default     = ["refs/tags/v*", "refs/heads/*"]
}

variable "github_deploy_repository" {
  description = "owner/name of the car-infra repository, whose Deploy workflow may run `make deploy` on the instance through SSM. Empty creates no deploy role (deploy from a laptop only)."
  type        = string
  default     = ""
}

variable "app_images" {
  description = "One ECR repository per entry, named <project>/<entry>. Must match the image names in compose.yml."
  type        = list(string)
  default     = ["carapi", "carweb"]
}
