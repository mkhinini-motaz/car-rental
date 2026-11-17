# Daily snapshot of the instance's disk, kept for seven days, through Data Lifecycle Manager.
# The database has its own backups (database.tf); this covers what lives only on the instance:
# env/*.env, secrets/, the api_files volume (car photos, handover photos, clients' papers) and
# Caddy's certificates. A rebuilt server can be
# restored from the latest snapshot instead of re-typing everything. Snapshots are incremental,
# so seven of a 30 GB disk cost about a dollar a month.

data "aws_iam_policy_document" "dlm_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["dlm.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "dlm" {
  name               = "${var.project}-dlm"
  assume_role_policy = data.aws_iam_policy_document.dlm_assume.json
}

resource "aws_iam_role_policy_attachment" "dlm" {
  role       = aws_iam_role.dlm.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSDataLifecycleManagerServiceRole"
}

resource "aws_dlm_lifecycle_policy" "instance" {
  description        = "${var.project}: daily snapshot of the app instance, 7 kept"
  execution_role_arn = aws_iam_role.dlm.arn
  state              = "ENABLED"

  policy_details {
    resource_types = ["INSTANCE"]
    target_tags    = { Name = "${var.project}-app" }

    schedule {
      name      = "daily"
      copy_tags = true

      create_rule {
        interval      = 24
        interval_unit = "HOURS"
        times         = ["03:00"] # UTC, after the RDS backup window
      }

      retain_rule {
        count = 7
      }
    }
  }
}
