#!/bin/bash

# 配置变量
BACKUP_DIR="/backup/postgres"
BACKUP_RETENTION_DAYS=7
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_CONTAINER="tradingbot_db_1"
DB_NAME="tradingbot"
S3_BUCKET="s3://tradingbot-backups"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 执行数据库备份
echo "Starting database backup..."
docker exec $DB_CONTAINER pg_dump -U postgres $DB_NAME | gzip > "$BACKUP_DIR/backup_${TIMESTAMP}.sql.gz"

# 上传到 S3
echo "Uploading backup to S3..."
aws s3 cp "$BACKUP_DIR/backup_${TIMESTAMP}.sql.gz" "$S3_BUCKET/backup_${TIMESTAMP}.sql.gz"

# 清理旧备份
echo "Cleaning up old backups..."
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +$BACKUP_RETENTION_DAYS -delete
aws s3 ls $S3_BUCKET --recursive | while read -r line; do
    createDate=$(echo $line | awk {'print $1" "$2'})
    createDate=$(date -d "$createDate" +%s)
    olderThan=$(date -d "$BACKUP_RETENTION_DAYS days ago" +%s)
    if [[ $createDate -lt $olderThan ]]; then
        fileName=$(echo $line | awk {'print $4'})
        if [[ $fileName != "" ]]; then
            aws s3 rm "$S3_BUCKET/$fileName"
        fi
    fi
done

echo "Backup completed successfully" 