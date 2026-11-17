# The one server. Ubuntu 24.04 from Canonical's published SSM parameter (always the current AMI),
# bootstrapped once by cloud-init.yaml, reachable on a fixed Elastic IP that DNS points at. Its
# disk is snapshotted daily (backup.tf) and it cannot be terminated by accident (see the variable).

data "aws_ssm_parameter" "ubuntu_ami" {
  name = "/aws/service/canonical/ubuntu/server/24.04/stable/current/${var.instance_architecture}/hvm/ebs-gp3/ami-id"
}

resource "aws_key_pair" "deployer" {
  key_name   = "${var.project}-deployer"
  public_key = var.ssh_public_key
}

# What the instance itself may do, through its role rather than any stored key: pull images from
# ECR (the credential helper on the box uses this), read the DB password parameter, be reachable through SSM (Session Manager for ssh, Run Command for the deploy
# workflow), and publish memory and disk metrics through the CloudWatch agent.
data "aws_iam_policy_document" "instance_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "instance" {
  statement {
    sid       = "EcrLogin"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "EcrPull"
    actions = [
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchCheckLayerAvailability",
    ]
    resources = [for r in aws_ecr_repository.app : r.arn]
  }

  statement {
    sid       = "ReadDbPassword"
    actions   = ["ssm:GetParameter"]
    resources = [aws_ssm_parameter.db_password.arn]
  }

  statement {
    sid       = "DecryptSsmParameters"
    actions   = ["kms:Decrypt"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["ssm.${var.region}.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "instance" {
  name               = "${var.project}-instance"
  assume_role_policy = data.aws_iam_policy_document.instance_assume.json
}

resource "aws_iam_role_policy" "instance" {
  name   = "${var.project}-instance"
  role   = aws_iam_role.instance.id
  policy = data.aws_iam_policy_document.instance.json
}

resource "aws_iam_role_policy_attachment" "instance_ssm" {
  role       = aws_iam_role.instance.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "instance_cloudwatch_agent" {
  role       = aws_iam_role.instance.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

resource "aws_iam_instance_profile" "instance" {
  name = "${var.project}-instance"
  role = aws_iam_role.instance.name
}

resource "aws_instance" "app" {
  ami                    = data.aws_ssm_parameter.ubuntu_ami.insecure_value
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public[0].id
  vpc_security_group_ids = [aws_security_group.instance.id]
  key_name               = aws_key_pair.deployer.key_name
  iam_instance_profile   = aws_iam_instance_profile.instance.name

  # Same idea as the database's deletion protection: the disk holds hand-made state.
  disable_api_termination = var.instance_termination_protection

  root_block_device {
    volume_size = var.root_volume_gb
    volume_type = "gp3"
    encrypted   = true
  }

  metadata_options {
    http_tokens = "required" # IMDSv2 only
  }

  user_data = templatefile("${path.module}/cloud-init.yaml", {
    ecr_registry = local.ecr_registry
    image_prefix = local.image_prefix
    domain       = var.domain
    acme_email   = var.acme_email
    region       = var.region
    architecture = var.instance_architecture
  })

  lifecycle {
    # A newer Ubuntu AMI or an edited cloud-init must never replace a running server on the next
    # apply. cloud-init is first boot only; change the server by hand or rebuild it deliberately
    # (taint it) after taking a database snapshot.
    ignore_changes = [ami, user_data]
  }

  tags = { Name = "${var.project}-app" }
}

resource "aws_eip" "app" {
  instance = aws_instance.app.id
  domain   = "vpc"
  tags     = { Name = "${var.project}-app" }
}
