output "instance_id" {
  description = "The server. `ssh -F ssh_config <this>` from car-infra (through Session Manager), and the INSTANCE_ID variable of the Deploy workflow."
  value       = aws_instance.app.id
}

output "instance_public_ip" {
  description = "The server's address, what DNS points at. Not for ssh unless ssh_allowed_cidrs is set."
  value       = aws_eip.app.public_ip
}

output "name_servers" {
  description = "Set these at the registrar for the domain."
  value       = aws_route53_zone.main.name_servers
}

output "db_endpoint" {
  description = "DB_HOST for env/api.env on the server."
  value       = aws_db_instance.main.address
}

output "db_password" {
  description = "DB_PASSWORD for env/api.env. Also in SSM at db_password_parameter."
  value       = random_password.db.result
  sensitive   = true
}

output "db_password_parameter" {
  value = aws_ssm_parameter.db_password.name
}

output "ecr_registry" {
  description = "Docker registry host. IMAGE_PREFIX on the server is <this>/<project>/"
  value       = local.ecr_registry
}

output "image_prefix" {
  value = local.image_prefix
}

output "github_actions_role_arn" {
  description = "role-to-assume for the build workflows."
  value       = aws_iam_role.github_actions.arn
}

output "github_deploy_role_arn" {
  description = "AWS_DEPLOY_ROLE_ARN for car-infra's Deploy workflow. Null until github_deploy_repository is set."
  value       = var.github_deploy_repository != "" ? aws_iam_role.github_deploy[0].arn : null
}
