#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    echo -e "${GREEN}[TradingBot]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# 检查Python版本
check_python_version() {
    if command -v python3.11 &>/dev/null; then
        PYTHON="python3.11"
    elif command -v python3 &>/dev/null; then
        PY_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
        if (( $(echo "$PY_VERSION >= 3.11" | bc -l) )); then
            PYTHON="python3"
        else
            print_error "需要Python 3.11或更高版本"
            exit 1
        fi
    else
        print_error "未找到Python 3.11或更高版本"
        exit 1
    fi
}

# 检查并安装系统依赖
install_system_deps() {
    print_message "检查系统依赖..."
    
    # 检查包管理器
    if command -v apt-get &>/dev/null; then
        sudo apt-get update
        sudo apt-get install -y \
            build-essential \
            python3-dev \
            libpq-dev \
            postgresql \
            postgresql-contrib \
            redis-server \
            libssl-dev \
            libffi-dev
    elif command -v brew &>/dev/null; then
        brew install \
            postgresql@15 \
            redis \
            openssl
    else
        print_error "不支持的操作系统，请手动安装依赖"
        exit 1
    fi
}

# 创建并激活虚拟环境
setup_venv() {
    print_message "设置虚拟环境..."
    if [ ! -d "venv" ]; then
        $PYTHON -m venv venv
    fi
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.consolidated.txt
}

# 配置PostgreSQL
setup_postgres() {
    print_message "配置PostgreSQL..."
    if command -v brew &>/dev/null; then
        brew services start postgresql@15
    else
        sudo systemctl start postgresql
    fi

    # 等待PostgreSQL启动
    sleep 5

    if command -v brew &>/dev/null; then
        # macOS方式
        createuser -s tradingbot || true
        createdb -O tradingbot tradingbot || true
        psql -d tradingbot -c "ALTER USER tradingbot WITH PASSWORD 'tradingbot';" || true
    else
        # Linux方式
        sudo -u postgres psql -c "CREATE USER tradingbot WITH PASSWORD 'tradingbot';" || true
        sudo -u postgres psql -c "CREATE DATABASE tradingbot OWNER tradingbot;" || true
        sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE tradingbot TO tradingbot;" || true
    fi

    # 验证数据库连接
    PGPASSWORD=tradingbot psql -h localhost -U tradingbot -d tradingbot -c "SELECT 1;" || \
        { print_error "数据库连接失败"; exit 1; }
}

# 配置Redis
setup_redis() {
    print_message "配置Redis..."
    if command -v brew &>/dev/null; then
        brew services start redis
    else
        sudo systemctl start redis-server
    fi
}

# 配置环境变量
setup_env() {
    print_message "配置环境变量..."
    if [ ! -f ".env" ]; then
        cp .env.example .env
        # 生成随机密钥
        echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env
        echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
    fi
}

# 安装项目包
install_project() {
    print_message "安装项目包..."
    pip install -e .
    export PYTHONPATH=$PWD:$PYTHONPATH
}

# 运行数据库迁移
run_migrations() {
    print_message "运行数据库迁移..."
    alembic upgrade head
}

# 运行测试和检查覆盖率
run_tests() {
    print_message "运行测试和检查覆盖率..."
    
    # 安装测试依赖
    pip install pytest pytest-asyncio pytest-cov
    
    # 运行测试并生成覆盖率报告
    pytest --cov=src --cov-report=html
    
    # 检查覆盖率是否达到90%
    COVERAGE=$(coverage report | tail -1 | awk '{print $4}' | sed 's/%//')
    if (( $(echo "$COVERAGE < 90" | bc -l) )); then
        print_error "测试覆盖率($COVERAGE%)低于要求的90%"
        exit 1
    else
        print_message "测试覆盖率: $COVERAGE%"
    fi
}

# 部署前端
deploy_frontend() {
    print_message "部署前端..."
    cd frontend/trading-ui
    
    # 检查Node.js
    if ! command -v node &> /dev/null; then
        print_error "未找到Node.js，请先安装Node.js"
        exit 1
    fi
    
    # 安装依赖
    npm install || {
        print_error "前端依赖安装失败"
        exit 1
    }
    
    # 启动开发服务器
    npm run dev &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > .frontend.pid
    
    cd ../..
    print_message "前端服务已启动: http://localhost:5173"
}

# 启动应用
start_app() {
    print_message "启动应用..."
    
    export PYTHONPATH=$PWD:$PYTHONPATH
    
    # 启动API服务
    uvicorn src.api_gateway.app.main:app --host 0.0.0.0 --port 8000 --reload &
    API_PID=$!
    
    # 启动交易代理
    python -m src.trading_agent.main &
    TRADING_PID=$!
    
    # 部署前端
    deploy_frontend
    
    # 等待服务启动
    sleep 5
    
    # 检查服务健康状态
    if curl -s http://localhost:8000/health > /dev/null; then
        print_message "API Gateway 运行正常"
    else
        print_error "API Gateway 启动失败"
    fi
    
    if curl -s http://localhost:8001/health > /dev/null; then
        print_message "Trading Agent 运行正常"
    else
        print_error "Trading Agent 启动失败"
    fi
    
    # 保存进程ID
    echo $API_PID > .api.pid
    echo $TRADING_PID > .trading.pid
    
    print_message "系统已启动！"
    print_message "API文档: http://localhost:8000/docs"
    print_message "前端界面: http://localhost:5173"
    print_message "使用 Ctrl+C 停止服务"
    
    # 等待用户中断
    wait
}

# 清理函数
cleanup() {
    print_message "正在停止服务..."
    
    # 停止后端服务
    if [ -f .api.pid ]; then
        kill $(cat .api.pid) 2>/dev/null
        rm .api.pid
    fi
    if [ -f .trading.pid ]; then
        kill $(cat .trading.pid) 2>/dev/null
        rm .trading.pid
    fi
    
    # 停止前端服务
    if [ -f frontend/trading-ui/.frontend.pid ]; then
        kill $(cat frontend/trading-ui/.frontend.pid) 2>/dev/null
        rm frontend/trading-ui/.frontend.pid
    fi
    
    deactivate 2>/dev/null
    print_message "所有服务已停止"
    exit 0
}

# 设置清理钩子
trap cleanup SIGINT SIGTERM

# 主函数
main() {
    cd "$(dirname "$0")"
    check_python_version
    install_system_deps
    setup_venv
    setup_postgres
    setup_redis
    install_project
    setup_env
    run_migrations
    run_tests
    start_app
}

main
