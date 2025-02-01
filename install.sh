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

# 检查系统要求
check_system_requirements() {
    log_info "检查系统要求..."
    
    # 检查操作系统
    if [[ "$(uname)" != "Darwin" ]]; then
        log_error "目前只支持macOS系统"
        exit 1
    fi
    
    # 检查必要工具
    command -v brew >/dev/null 2>&1 || {
        log_error "需要安装Homebrew"
        echo "请访问 https://brew.sh/ 安装Homebrew"
        exit 1
    }
}

# 安装系统依赖
install_system_dependencies() {
    log_info "安装系统依赖..."
    
    # 更新Homebrew
    brew update
    
    # 安装基础工具
    brew install wget curl git tmux

    # 安装Python
    brew install python@3.11
    
    # 安装Go
    brew install go@1.21
    
    # 安装Node.js
    brew install node@18
    
    # 安装数据库
    brew install postgresql@14
    brew install mongodb-community
    brew install redis
    
    # 安装监控工具
    brew install prometheus
    brew install grafana
    
    # 安装Protocol Buffers
    brew install protobuf
    
    # 安装开发工具
    brew install make cmake
}

# 安装Python依赖
install_python_dependencies() {
    log_info "安装Python依赖..."
    
    # 创建虚拟环境
    python3.11 -m venv venv
    source venv/bin/activate
    
    # 升级pip
    pip install --upgrade pip
    
    # 安装依赖
    pip install -r requirements.txt
}

# 安装Node.js依赖
install_node_dependencies() {
    log_info "安装Node.js依赖..."
    
    # 安装pnpm
    npm install -g pnpm
    
    # 进入前端目录
    cd src/frontend
    
    # 安装依赖
    pnpm install
    
    # 返回根目录
    cd ../..
}

# 安装Go依赖
install_go_dependencies() {
    log_info "安装Go依赖..."
    
    # 进入Go执行器目录
    cd src/go_executor
    
    # 下载依赖
    go mod download
    
    # 返回根目录
    cd ../..
}

# 配置环境
setup_environment() {
    log_info "配置环境..."
    
    # 复制环境变量示例文件
    cp config/.env.example config/.env
    
    # 创建必要的目录
    mkdir -p /data/prometheus
    mkdir -p /data/backups
    mkdir -p /var/log/tradingbot
    
    # 设置目录权限
    chmod -R 755 /data/prometheus
    chmod -R 755 /data/backups
    chmod -R 755 /var/log/tradingbot
}

# 配置数据库
setup_databases() {
    log_info "配置数据库..."
    
    # 启动PostgreSQL
    brew services start postgresql@14
    
    # 创建数据库和用户
    psql postgres -c "CREATE DATABASE tradingbot;"
    psql postgres -c "CREATE USER admin WITH ENCRYPTED PASSWORD 'secret';"
    psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE tradingbot TO admin;"
    
    # 启动MongoDB
    brew services start mongodb-community
    
    # 启动Redis
    brew services start redis
}

# 配置监控
setup_monitoring() {
    log_info "配置监控..."
    
    # 复制Prometheus配置
    cp config/prometheus/prometheus.yml /data/prometheus/
    
    # 启动Prometheus
    brew services start prometheus
    
    # 启动Grafana
    brew services start grafana
}

# 验证安装
verify_installation() {
    log_info "验证安装..."
    
    # 检查Python
    python3.11 --version
    
    # 检查Node.js
    node --version
    
    # 检查Go
    go version
    
    # 检查数据库
    pg_isready
    mongosh --eval "db.version()"
    redis-cli ping
    
    # 检查监控服务
    curl -f http://localhost:9090/-/healthy
    curl -f http://localhost:3000/api/health
}

# 主函数
main() {
    log_info "开始安装TradingBot..."
    
    # 检查系统要求
    check_system_requirements
    
    # 安装依赖
    install_system_dependencies
    install_python_dependencies
    install_node_dependencies
    install_go_dependencies
    
    # 配置环境
    setup_environment
    setup_databases
    setup_monitoring
    
    # 验证安装
    verify_installation
    
    log_info "安装完成!"
    log_info "请编辑 config/.env 文件配置您的环境变量"
    log_info "使用 ./scripts/run/run_local.sh 启动服务"
}

# 执行主函数
main
