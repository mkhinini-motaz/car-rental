# An email when something is wrong, and another when it is right again. Set alert_email to turn
# it on (the log group below exists either way, since the containers write to it); SNS sends a confirmation to click, once per topic. Two topics because Route 53 publishes
# its health-check metrics only in us-east-1, so the "is the API up" alarm has to live there.
# Memory and disk come from the CloudWatch agent cloud-init installs (EC2 alone reports neither);
# on a 2 GB single server those two are the ones that actually page.

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project   = var.project
      ManagedBy = "terraform"
    }
  }
}

locals {
  alerts = var.alert_email != "" ? 1 : 0
}

resource "aws_sns_topic" "alerts" {
  count = local.alerts
  name  = "${var.project}-alerts"
}

resource "aws_sns_topic_subscription" "alerts_email" {
  count     = local.alerts
  topic_arn = aws_sns_topic.alerts[0].arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_sns_topic" "alerts_global" {
  count    = local.alerts
  provider = aws.us_east_1
  name     = "${var.project}-alerts"
}

resource "aws_sns_topic_subscription" "alerts_global_email" {
  count     = local.alerts
  provider  = aws.us_east_1
  topic_arn = aws_sns_topic.alerts_global[0].arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# Is the API answering from the outside? Route 53 probes https://api.<domain>/up from
# several regions every 30 seconds. Until DNS points at the server this alarm is in ALARM, which
# is correct: the site is not reachable yet.
resource "aws_route53_health_check" "api" {
  count             = local.alerts
  fqdn              = "api.${var.domain}"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/up"
  request_interval  = 30
  failure_threshold = 3

  tags = { Name = "${var.project}-api" }
}

resource "aws_cloudwatch_metric_alarm" "api_down" {
  count    = local.alerts
  provider = aws.us_east_1

  alarm_name          = "${var.project}-api-down"
  alarm_description   = "https://api.${var.domain}/up is failing from the outside"
  namespace           = "AWS/Route53"
  metric_name         = "HealthCheckStatus"
  dimensions          = { HealthCheckId = aws_route53_health_check.api[0].id }
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 3
  threshold           = 1
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.alerts_global[0].arn]
  ok_actions          = [aws_sns_topic.alerts_global[0].arn]
}

resource "aws_cloudwatch_metric_alarm" "instance_status" {
  count = local.alerts

  alarm_name          = "${var.project}-instance-status-check"
  alarm_description   = "EC2 status checks failing: the instance or its host is unhealthy"
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed"
  dimensions          = { InstanceId = aws_instance.app.id }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 3
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]
  ok_actions          = [aws_sns_topic.alerts[0].arn]
}

resource "aws_cloudwatch_metric_alarm" "instance_cpu" {
  count = local.alerts

  alarm_name          = "${var.project}-instance-cpu"
  alarm_description   = "Instance CPU above 90% for 15 minutes"
  namespace           = "AWS/EC2"
  metric_name         = "CPUUtilization"
  dimensions          = { InstanceId = aws_instance.app.id }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 90
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]
  ok_actions          = [aws_sns_topic.alerts[0].arn]
}

resource "aws_cloudwatch_metric_alarm" "db_free_storage" {
  count = local.alerts

  alarm_name          = "${var.project}-db-free-storage"
  alarm_description   = "RDS free storage below 2 GB (storage autoscaling should kick in first; this is the backstop)"
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.main.identifier }
  statistic           = "Minimum"
  period              = 300
  evaluation_periods  = 2
  threshold           = 2 * 1024 * 1024 * 1024
  comparison_operator = "LessThanThreshold"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]
  ok_actions          = [aws_sns_topic.alerts[0].arn]
}

resource "aws_cloudwatch_metric_alarm" "db_cpu" {
  count = local.alerts

  alarm_name          = "${var.project}-db-cpu"
  alarm_description   = "RDS CPU above 80% for 15 minutes"
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.main.identifier }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]
  ok_actions          = [aws_sns_topic.alerts[0].arn]
}

resource "aws_cloudwatch_metric_alarm" "instance_memory" {
  count = local.alerts

  alarm_name          = "${var.project}-instance-memory"
  alarm_description   = "Instance memory above 90% for 15 minutes (CloudWatch agent)"
  namespace           = "CWAgent"
  metric_name         = "mem_used_percent"
  dimensions          = { InstanceId = aws_instance.app.id }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 90
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]
  ok_actions          = [aws_sns_topic.alerts[0].arn]
}

resource "aws_cloudwatch_metric_alarm" "instance_disk" {
  count = local.alerts

  alarm_name          = "${var.project}-instance-disk"
  alarm_description   = "Root disk above 85% full (CloudWatch agent); the weekly image prune is not keeping up"
  namespace           = "CWAgent"
  metric_name         = "disk_used_percent"
  dimensions          = { InstanceId = aws_instance.app.id }
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 85
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]
  ok_actions          = [aws_sns_topic.alerts[0].arn]
}

# The containers' output (compose.prod.yml sends it with Docker's awslogs driver): carapi's Laravel
# log, php and nginx, the web app and Caddy, one stream per container. A month is enough to look
# into a problem someone reports; the database backups are what keep history.
resource "aws_cloudwatch_log_group" "app" {
  name              = var.project
  retention_in_days = 30
}

# Error reporting: every line carapi logs at ERROR or above (an exception, or an SMS or push the
# gateway refused, which carapi logs rather than fails on) counts once. The email says only that
# there were errors; `make errors` on the laptop prints them with the stack trace.
resource "aws_cloudwatch_log_metric_filter" "api_errors" {
  name           = "${var.project}-api-errors"
  log_group_name = aws_cloudwatch_log_group.app.name
  pattern        = "?\".ERROR:\" ?\".CRITICAL:\" ?\".ALERT:\" ?\".EMERGENCY:\""

  metric_transformation {
    name      = "ApiErrors"
    namespace = var.project
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "api_errors" {
  count = local.alerts

  alarm_name          = "${var.project}-api-errors"
  alarm_description   = "carapi logged an error in the last 5 minutes: run `make errors` in car-infra, or open the ${var.project} log group in CloudWatch"
  namespace           = var.project
  metric_name         = "ApiErrors"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]
  ok_actions          = [aws_sns_topic.alerts[0].arn]
}
