# Managed MySQL. The one component that holds state nothing else can regenerate, so it is the one
# component that is not a container: automated daily backups with 7 days of retention, storage
# encryption, deletion protection, and a final snapshot on destroy.

resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_db_subnet_group" "main" {
  name       = "${var.project}-db"
  subnet_ids = aws_subnet.private[*].id
  tags       = { Name = "${var.project}-db" }
}

resource "aws_db_instance" "main" {
  identifier = "${var.project}-mysql"

  engine         = "mysql"
  engine_version = "8.4"
  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.database.id]
  publicly_accessible    = false
  multi_az               = false

  backup_retention_period    = 7
  backup_window              = "02:00-03:00"
  maintenance_window         = "sun:03:30-sun:04:30"
  auto_minor_version_upgrade = true
  copy_tags_to_snapshot      = true

  deletion_protection       = var.db_deletion_protection
  skip_final_snapshot       = var.db_skip_final_snapshot
  final_snapshot_identifier = var.db_skip_final_snapshot ? null : "${var.project}-mysql-final"

  tags = { Name = "${var.project}-mysql" }
}

# The password is also here so the server (and a human with the CLI) can read it without the
# Terraform state: aws ssm get-parameter --with-decryption --name /<project>/db/password
resource "aws_ssm_parameter" "db_password" {
  name  = "/${var.project}/db/password"
  type  = "SecureString"
  value = random_password.db.result
}
