# Creates the bucket the main configuration keeps its state in. Chicken and egg: this one keeps its
# own state locally (bootstrap/terraform.tfstate, gitignored), which is fine because the only thing
# in it is a bucket that is trivial to import again.
#
#   cd terraform/bootstrap && tofu init && tofu apply -var bucket=carrental-terraform-state-<something unique>

terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

variable "region" {
  type    = string
  default = "eu-west-3"
}

variable "bucket" {
  description = "Globally unique bucket name for the Terraform state."
  type        = string
}

provider "aws" {
  region = var.region
}

resource "aws_s3_bucket" "state" {
  bucket = var.bucket
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

output "bucket" {
  description = "Put this in ../backend.hcl"
  value       = aws_s3_bucket.state.bucket
}
