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

# 修复环境配置
fix_environment() {
    log_info "修复环境配置..."
    
    # 检查并创建.env文件
    if [ ! -f "config/.env" ]; then
        cp config/.env.example config/.env
        log_info "已创建环境配置文件"
    fi
    
    # 设置文件权限
    chmod 600 config/.env
    log_info "已设置环境文件权限"
    
    # 检查必要的环境变量
    source config/.env
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
            log_warn "设置默认 $var"
            case $var in
                "APP_ENV")
                    echo "APP_ENV=development" >> config/.env
                    ;;
                "API_PORT")
                    echo "API_PORT=8000" >> config/.env
                    ;;
                "TRADING_PORT")
                    echo "TRADING_PORT=8001" >> config/.env
                    ;;
                "FRONTEND_PORT")
                    echo "FRONTEND_PORT=3000" >> config/.env
                    ;;
                "MONGODB_URI")
                    echo "MONGODB_URI=mongodb://localhost:27017/tradingbot" >> config/.env
                    ;;
                "REDIS_URI")
                    echo "REDIS_URI=redis://localhost:6379/0" >> config/.env
                    ;;
                "JWT_SECRET")
                    echo "JWT_SECRET=$(openssl rand -hex 32)" >> config/.env
                    ;;
            esac
        fi
    done
}

# 修复依赖项
fix_dependencies() {
    log_info "修复依赖项..."
    
    # 修复Python依赖
    if [ ! -d "venv" ]; then
        python3 -m venv venv
        log_info "已创建Python虚拟环境"
    fi
    
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    deactivate
    log_info "已安装Python依赖"
    
    # 修复Node.js依赖
    if [ -f "src/frontend/package.json" ]; then
        cd src/frontend
        npm install
        cd ../..
        log_info "已安装前端依赖"
    fi
    
    # 修复Go依赖
    if [ -f "src/go_executor/go.mod" ]; then
        cd src/go_executor
        go mod download
        go mod tidy
        cd ../..
        log_info "已更新Go依赖"
    fi
}

# 修复数据库
fix_databases() {
    log_info "修复数据库..."
    
    # 启动MongoDB
    if ! mongosh --eval "db.runCommand({ping: 1})" >/dev/null 2>&1; then
        brew services restart mongodb-community
        log_info "已重启MongoDB服务"
    fi
    
    # 启动Redis
    if ! redis-cli ping >/dev/null 2>&1; then
        brew services restart redis
        log_info "已重启Redis服务"
    fi
    
    # 启动PostgreSQL
    if ! pg_isready >/dev/null 2>&1; then
        brew services restart postgresql
        log_info "已重启PostgreSQL服务"
    fi
    
    # 等待服务启动
    sleep 5
    
    # 创建数据库和用户
    if pg_isready >/dev/null 2>&1; then
        psql postgres -c "CREATE DATABASE tradingbot;" 2>/dev/null || true
        psql postgres -c "CREATE USER admin WITH ENCRYPTED PASSWORD 'secret';" 2>/dev/null || true
        psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE tradingbot TO admin;" 2>/dev/null || true
        log_info "已配置PostgreSQL数据库"
    fi
}

# 修复服务
fix_services() {
    log_info "修复服务..."
    
    # 停止所有服务
    docker-compose -f config/docker/docker-compose.yml down 2>/dev/null || true
    
    # 重新构建镜像
    docker-compose -f config/docker/docker-compose.yml build
    
    # 启动服务
    docker-compose -f config/docker/docker-compose.yml up -d
    
    log_info "已重启所有服务"
}

# 修复日志
fix_logs() {
    log_info "修复日志配置..."
    
    local log_dir="/var/log/tradingbot"
    
    # 创建日志目录
    sudo mkdir -p "$log_dir"
    sudo chmod 755 "$log_dir"
    
    # 创建日志文件
    local log_files=("app.log" "error.log" "access.log")
    for log_file in "${log_files[@]}"; do
        sudo touch "$log_dir/$log_file"
        sudo chmod 644 "$log_dir/$log_file"
    done
    
    # 设置所有权
    sudo chown -R $(whoami):staff "$log_dir"
    
    log_info "已配置日志目录和文件"
}

# 修复备份
fix_backups() {
    log_info "修复备份配置..."
    
    local backup_dir="/data/backups"
    
    # 创建备份目录
    sudo mkdir -p "$backup_dir"
    sudo chmod 755 "$backup_dir"
    sudo chown $(whoami):staff "$backup_dir"
    
    # 创建备份脚本
    cat > scripts/backup.sh << 'EOF'
#!/bin/bash
timestamp=$(date +%Y%m%d_%H%M%S)
backup_dir="/data/backups/$timestamp"
mkdir -p "$backup_dir"

# 备份MongoDB
mongodump --uri="$MONGODB_URI" --out="$backup_dir/mongodb"

# 备份PostgreSQL
pg_dump -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" > "$backup_dir/postgres.sql"

# 压缩备份
cd /data/backups
tar -czf "$timestamp.tar.gz" "$timestamp"
rm -rf "$timestamp"

# 清理旧备份
find /data/backups -name "*.tar.gz" -type f -mtime +30 -delete
EOF
    
    chmod +x scripts/backup.sh
    
    # 添加到crontab
    (crontab -l 2>/dev/null; echo "0 0 * * * $(pwd)/scripts/backup.sh") | crontab -
    
    log_info "已配置备份系统"
}

# 修复安全配置
fix_security() {
    log_info "修复安全配置..."
    
    # 生成SSL证书
    if [ "$ENABLE_SSL" = "true" ]; then
        mkdir -p /etc/ssl/certs/tradingbot
        mkdir -p /etc/ssl/private/tradingbot
        
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout /etc/ssl/private/tradingbot/tradingbot.key \
            -out /etc/ssl/certs/tradingbot/tradingbot.crt \
            -subj "/C=CN/ST=Shanghai/L=Shanghai/O=TradingBot/CN=localhost"
            
        chmod 600 /etc/ssl/private/tradingbot/tradingbot.key
        chmod 644 /etc/ssl/certs/tradingbot/tradingbot.crt
        
        log_info "已生成SSL证书"
    fi
    
    # 检查并更新JWT密钥
    if [ -z "$JWT_SECRET" ] || [ ${#JWT_SECRET} -lt 32 ]; then
        sed -i '' "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" config/.env
        log_info "已更新JWT密钥"
    fi
    
    # 设置敏感文件权限
    find . -name "*.key" -exec chmod 600 {} \;
    find . -name "*.crt" -exec chmod 644 {} \;
    chmod 600 config/.env
    
    log_info "已更新安全配置"
}

# 修复监控
fix_monitoring() {
    log_info "修复监控系统..."
    
    # 确保Prometheus配置目录存在
    sudo mkdir -p /data/prometheus
    sudo chown $(whoami):staff /data/prometheus
    
    # 复制Prometheus配置
    cp config/prometheus/prometheus.yml /data/prometheus/
    
    # 启动监控服务
    brew services restart prometheus
    brew services restart grafana
    
    log_info "已重启监控服务"
}

# 主函数
main() {
    log_info "开始修复部署问题...\n"
    
    # 运行测试脚本获取问题列表
    ./scripts/test_deployment.sh > test_results.txt
    
    # 根据测试结果修复问题
    if grep -q "环境配置文件.*fail" test_results.txt; then
        fix_environment
    fi
    
    if grep -q "依赖.*fail\|依赖.*warn" test_results.txt; then
        fix_dependencies
    fi
    
    if grep -q "数据库.*fail" test_results.txt; then
        fix_databases
    fi
    
    if grep -q "服务.*fail" test_results.txt; then
        fix_services
    fi
    
    if grep -q "日志.*fail\|日志.*warn" test_results.txt; then
        fix_logs
    fi
    
    if grep -q "备份.*fail\|备份.*warn" test_results.txt; then
        fix_backups
    fi
    
    if grep -q "安全.*fail\|安全.*warn" test_results.txt; then
        fix_security
    fi
    
    if grep -q "Prometheus.*fail\|Grafana.*fail" test_results.txt; then
        fix_monitoring
    fi
    
    # 清理测试结果
    rm test_results.txt
    
    log_info "修复完成,正在重新测试..."
    
    # 重新运行测试
    ./scripts/test_deployment.sh
}

# 执行主函数
main
