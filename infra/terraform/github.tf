# GitHub Actions pushes images to ECR by assuming this role with its OIDC token: no access key
# is ever created or stored in GitHub. Only workflows from the listed repositories, running from
# the listed refs, may assume it, and the role can do nothing but push to and pull from the app
# repositories. A second role, for car-infra's Deploy workflow, can only run a command on the
# instance through SSM.

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1", "1c58a3a8518e8759bf075b76b750d4f2df264fcd"]
}

data "aws_iam_policy_document" "github_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = flatten([for r in var.github_repositories : [for ref in var.github_allowed_refs : "repo:${r}:ref:${ref}"]])
    }
  }
}

data "aws_iam_policy_document" "github" {
  statement {
    sid       = "EcrLogin"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "EcrPushPull"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:DescribeImages",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
    ]
    resources = [for r in aws_ecr_repository.app : r.arn]
  }
}

resource "aws_iam_role" "github_actions" {
  name               = "${var.project}-github-actions"
  assume_role_policy = data.aws_iam_policy_document.github_assume.json
}

resource "aws_iam_role_policy" "github_actions" {
  name   = "${var.project}-github-actions"
  role   = aws_iam_role.github_actions.id
  policy = data.aws_iam_policy_document.github.json
}

# ---- Deploy role: car-infra's workflow runs `make deploy` on the instance through SSM ----

locals {
  deploy_role = var.github_deploy_repository != "" ? 1 : 0
}

data "aws_iam_policy_document" "github_deploy_assume" {
  count = local.deploy_role

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_deploy_repository}:ref:refs/heads/*"]
    }
  }
}

data "aws_iam_policy_document" "github_deploy" {
  count = local.deploy_role

  statement {
    sid       = "RunShellOnTheInstance"
    actions   = ["ssm:SendCommand"]
    resources = [aws_instance.app.arn, "arn:aws:ssm:${var.region}::document/AWS-RunShellScript"]
  }

  statement {
    sid       = "ReadCommandResult"
    actions   = ["ssm:GetCommandInvocation"]
    resources = ["*"]
  }
}

resource "aws_iam_role" "github_deploy" {
  count              = local.deploy_role
  name               = "${var.project}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_deploy_assume[0].json
}

resource "aws_iam_role_policy" "github_deploy" {
  count  = local.deploy_role
  name   = "${var.project}-github-deploy"
  role   = aws_iam_role.github_deploy[0].id
  policy = data.aws_iam_policy_document.github_deploy[0].json
}
