# Route 53 hosts the domain. After the first apply, point the registrar at `tofu output name_servers`.
# Every hostname is an A record to the instance's Elastic IP; Caddy tells them apart.

resource "aws_route53_zone" "main" {
  name = var.domain
}

locals {
  hostnames = {
    apex = var.domain
    www  = "www.${var.domain}"
    api  = "api.${var.domain}"
  }
}

resource "aws_route53_record" "app" {
  for_each = local.hostnames

  zone_id = aws_route53_zone.main.zone_id
  name    = each.value
  type    = "A"
  ttl     = 300
  records = [aws_eip.app.public_ip]
}

# Only Let's Encrypt may issue certificates for the domain. Caddy uses Let's Encrypt; any other
# CA asked to issue for these names (by mistake or by an attacker) must refuse.
resource "aws_route53_record" "caa" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain
  type    = "CAA"
  ttl     = 3600
  records = ["0 issue \"letsencrypt.org\""]
}
