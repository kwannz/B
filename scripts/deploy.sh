#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查环境变量
check_env() {
    local env_file="config/.env"
    if [ ! -f "$env_file" ]; then
        log_error "环境配置文件不存在: $env_file"
        exit 1
    fi
    
    # 加载环境变量
    set -a
    source "$env_file"
    set +a
    
    # 检查必要的环境变量
    local required_vars=(
        "APP_ENV"
        "API_PORT"
        "TRADING_PORT"
        "FRONTEND_PORT"
        "MONGODB_URI"
        "REDIS_URI"
        "JWT_SECRET"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            log_error "缺少必要的环境变量: $var"
            exit 1
        fi
    done
}

# 构建Docker镜像
build_images() {
    log_info "构建Docker镜像..."
    
    # 构建API镜像
    log_info "构建API镜像..."
    docker build -t tradingbot/api:latest \
        --target api \
        -f Dockerfile .
    
    # 构建前端镜像
    log_info "构建前端镜像..."
    docker build -t tradingbot/frontend:latest \
        --target production \
        -f src/frontend/Dockerfile src/frontend
    
    # 构建执行器镜像
    log_info "构建执行器镜像..."
    docker build -t tradingbot/executor:latest \
        -f src/go_executor/Dockerfile src/go_executor
}

# 部署服务
deploy_services() {
    local env=$1
    log_info "部署服务到 $env 环境..."
    
    # 选择正确的docker-compose文件
    local compose_file="config/docker/docker-compose.$env.yml"
    if [ ! -f "$compose_file" ]; then
        log_error "找不到docker-compose文件: $compose_file"
        exit 1
    }
    
    # 停止现有服务
    docker-compose -f "$compose_file" down
    
    # 启动新服务
    docker-compose -f "$compose_file" up -d
    
    # 等待服务启动
    log_info "等待服务启动..."
    sleep 30
    
    # 检查服务健康状态
    check_services_health
}

# 检查服务健康状态
check_services_health() {
    log_info "检查服务健康状态..."
    
    local services=(
        "api:${API_PORT}/health"
        "frontend:${FRONTEND_PORT}"
        "executor:${TRADING_PORT}/health"
        "prometheus:${PROMETHEUS_PORT}/-/healthy"
        "grafana:${GRAFANA_PORT}/api/health"
    )
    
    for service in "${services[@]}"; do
        IFS=':' read -r name port_path <<< "$service"
        if ! curl -sf "http://localhost:$port_path" > /dev/null; then
            log_error "$name 服务未正常运行"
            exit 1
        fi
        log_info "$name 服务运行正常"
    done
}

# 数据库迁移
run_migrations() {
    log_info "运行数据库迁移..."
    
    # 执行迁移脚本
    python3 -m alembic upgrade head
}

# 备份数据
backup_data() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_dir="/data/backups/$timestamp"
    
    log_info "备份数据到 $backup_dir..."
    
    # 创建备份目录
    mkdir -p "$backup_dir"
    
    # 备份MongoDB
    mongodump --uri="$MONGODB_URI" --out="$backup_dir/mongodb"
    
    # 备份PostgreSQL
    pg_dump -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" > "$backup_dir/postgres.sql"
    
    # 压缩备份
    cd /data/backups
    tar -czf "$timestamp.tar.gz" "$timestamp"
    rm -rf "$timestamp"
    
    log_info "备份完成: $timestamp.tar.gz"
}

# 清理旧备份
cleanup_old_backups() {
    log_info "清理旧备份..."
    
    # 保留最近30天的备份
    find /data/backups -name "*.tar.gz" -type f -mtime +30 -delete
}

# 发送通知
send_notification() {
    local status=$1
    local message=$2
    
    if [ -n "$ALERT_SLACK_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"[$status] $message\"}" \
            "$ALERT_SLACK_WEBHOOK"
    fi
    
    if [ -n "$ALERT_TELEGRAM_BOT_TOKEN" ] && [ -n "$ALERT_TELEGRAM_CHAT_ID" ]; then
        curl -X POST \
            "https://api.telegram.org/bot$ALERT_TELEGRAM_BOT_TOKEN/sendMessage" \
            -d "chat_id=$ALERT_TELEGRAM_CHAT_ID" \
            -d "text=[$status] $message"
    fi
}

# 回滚部署
rollback_deployment() {
    log_error "部署失败,开始回滚..."
    
    # 恢复之前的版本
    docker-compose -f "$compose_file" down
    docker-compose -f "$compose_file" up -d --no-deps --build api frontend executor
    
    send_notification "ERROR" "部署失败,已回滚到之前版本"
    exit 1
}

# 主函数
main() {
    local env=${1:-"dev"}
    
    # 验证环境参数
    case "$env" in
        "dev"|"staging"|"prod")
            ;;
        *)
            log_error "无效的环境参数: $env (可用选项: dev, staging, prod)"
            exit 1
            ;;
    esac
    
    log_info "开始部署到 $env 环境..."
    
    # 检查环境变量
    check_env
    
    # 备份数据
    if [ "$env" = "prod" ]; then
        backup_data
    fi
    
    # 构建和部署
    build_images || rollback_deployment
    deploy_services "$env" || rollback_deployment
    
    # 运行迁移
    run_migrations || rollback_deployment
    
    # 清理旧备份
    if [ "$env" = "prod" ]; then
        cleanup_old_backups
    fi
    
    # 发送成功通知
    send_notification "SUCCESS" "部署完成: $env 环境"
    
    log_info "部署完成!"
}

# 解析命令行参数
while getopts ":e:" opt; do
    case $opt in
        e)
            ENV="$OPTARG"
            ;;
        \?)
            log_error "无效的选项: -$OPTARG"
            exit 1
            ;;
        :)
            log_error "选项 -$OPTARG 需要参数"
            exit 1
            ;;
    esac
done

# 执行主函数
main "${ENV:-dev}"
