#!/bin/bash

# ROOMS Bot Backup Script
# Trusted by Helius • Powered by Turnkey

BACKUP_DIR="/backups/rooms"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="rooms_db"

mkdir -p "$BACKUP_DIR"

echo "🔄 Starting database backup..."

# Backup database
pg_dump "$DATABASE_URL" > "$BACKUP_DIR/db_backup_$TIMESTAMP.sql"

# Compress backup
gzip "$BACKUP_DIR/db_backup_$TIMESTAMP.sql"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "db_backup_*.sql.gz" -mtime +7 -delete

echo "✅ Backup completed: db_backup_$TIMESTAMP.sql.gz"

# Upload to S3 (if configured)
if [ -n "$AWS_S3_BUCKET" ]; then
    aws s3 cp "$BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz" \
        "s3://$AWS_S3_BUCKET/backups/db_backup_$TIMESTAMP.sql.gz"
    echo "📤 Uploaded to S3"
fi

