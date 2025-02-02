#!/bin/bash

# 配置变量
DB_CONTAINER="tradingbot_db_1"
DB_NAME="tradingbot"
S3_BUCKET="s3://tradingbot-backups"
BACKUP_DIR="/backup/postgres"

# 如果没有指定备份文件，使用最新的备份
if [ -z "$1" ]; then
    BACKUP_FILE=$(aws s3 ls $S3_BUCKET --recursive | sort | tail -n 1 | awk '{print $4}')
else
    BACKUP_FILE=$1
fi

# 下载备份文件
echo "Downloading backup file from S3..."
aws s3 cp "$S3_BUCKET/$BACKUP_FILE" "$BACKUP_DIR/$BACKUP_FILE"

# 停止依赖服务
echo "Stopping dependent services..."
docker-compose stop backend backend-canary

# 恢复数据库
echo "Restoring database..."
gunzip -c "$BACKUP_DIR/$BACKUP_FILE" | docker exec -i $DB_CONTAINER psql -U postgres $DB_NAME

# 启动服务
echo "Starting services..."
docker-compose start backend backend-canary

# 验证恢复
echo "Verifying database restore..."
docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -c "SELECT NOW();"

echo "Database restore completed successfully" 