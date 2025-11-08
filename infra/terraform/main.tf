# ROOMS Terraform Infrastructure
# Trusted by Helius • Powered by Turnkey

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

resource "aws_db_instance" "rooms_db" {
  identifier     = "rooms-postgres"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.t3.micro"
  
  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp3"
  
  db_name  = "rooms_db"
  username = "rooms"
  password = var.db_password
  
  vpc_security_group_ids = [aws_security_group.db.id]
  db_subnet_group_name   = aws_db_subnet_group.rooms.name
  
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "mon:04:00-mon:05:00"
  
  skip_final_snapshot = false
  final_snapshot_identifier = "rooms-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"
  
  tags = {
    Name = "ROOMS Database"
    Environment = var.environment
  }
}

resource "aws_security_group" "db" {
  name_prefix = "rooms-db-"
  vpc_id      = var.vpc_id
  
  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_subnet_group" "rooms" {
  name       = "rooms-db-subnet-group"
  subnet_ids = var.subnet_ids
  
  tags = {
    Name = "ROOMS DB Subnet Group"
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
}

variable "subnet_ids" {
  description = "Subnet IDs for DB"
  type        = list(string)
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

output "db_endpoint" {
  value       = aws_db_instance.rooms_db.endpoint
  description = "Database endpoint"
}

