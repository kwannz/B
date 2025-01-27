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
    if ! command -v python3.11 &> /dev/null; then
        print_error "需要Python 3.11或更高版本"
        exit 1
    fi
}

# 检查并安装系统依赖
install_system_deps() {
    print_message "检查系统依赖..."
    brew install postgresql@15
    brew install redis
    brew install openssl@3
}

# 创建并激活虚拟环境
setup_venv() {
    print_message "设置虚拟环境..."
    if [ ! -d "venv" ]; then
        python3.11 -m venv venv
    fi
    source venv/bin/activate
    python -m pip install --upgrade pip
    pip install -r requirements.consolidated.txt
}

# 配置PostgreSQL
setup_postgresql() {
    print_message "配置PostgreSQL..."
    
    # 启动PostgreSQL服务
    print_message "正在启动PostgreSQL服务..."
    brew services restart postgresql@15
    
    # 设置PostgreSQL命令行工具路径
    PG_PATH="/usr/local/opt/postgresql@15/bin"
    print_message "PostgreSQL命令行工具路径: $PG_PATH"
    
    # 检查命令行工具是否存在
    if [ ! -f "$PG_PATH/createuser" ] || [ ! -f "$PG_PATH/createdb" ] || [ ! -f "$PG_PATH/psql" ]; then
        print_error "PostgreSQL命令行工具未找到"
        ls -l $PG_PATH
        exit 1
    fi
    
    # 等待PostgreSQL服务启动
    print_message "等待PostgreSQL服务启动..."
    sleep 5
    
    # 创建用户和数据库（忽略已存在的错误）
    print_message "创建用户和数据库..."
    "$PG_PATH/createuser" -s tradingbot 2>/dev/null || true
    "$PG_PATH/createdb" -O tradingbot tradingbot 2>/dev/null || true
    "$PG_PATH/psql" -d tradingbot -c "ALTER USER tradingbot WITH PASSWORD 'tradingbot';" || {
        print_error "无法设置用户密码"
        exit 1
    }
    
    # 测试数据库连接
    print_message "测试数据库连接..."
    if ! "$PG_PATH/psql" -d tradingbot -U tradingbot -c "\q" &> /dev/null; then
        print_error "数据库连接失败"
        "$PG_PATH/psql" -d tradingbot -U tradingbot -c "\conninfo"
        exit 1
    fi
    
    print_success "PostgreSQL配置完成"
}

# 配置Redis
setup_redis() {
    print_message "配置Redis..."
    brew services start redis
}

# 配置环境变量
setup_env() {
    print_message "配置环境变量..."
    export PYTHONPATH=$PWD:$PYTHONPATH
    export DATABASE_URL="postgresql://tradingbot:tradingbot@localhost:5432/tradingbot"
    export REDIS_URL="redis://localhost:6379/0"
}

# 安装项目包
install_project() {
    print_message "安装项目包..."
    pip install -e .
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
    
    # 启动后端API服务
    uvicorn src.api_gateway.app.main:app --host 0.0.0.0 --port 8000 --reload &
    API_PID=$!
    echo $API_PID > .api.pid
    
    # 部署前端
    deploy_frontend
    
    print_message "系统已启动！"
    print_message "API文档: http://localhost:8000/docs"
    print_message "前端界面: http://localhost:5173"
    print_message "使用 Ctrl+C 停止服务"
    
    # 等待用户中断
    wait
}

# 清理函数
cleanup() {
    print_message "清理进程..."
    
    # 停止后端服务
    if [ -f .api.pid ]; then
        kill $(cat .api.pid) 2>/dev/null
        rm .api.pid
    fi
    
    # 停止前端服务
    if [ -f frontend/trading-ui/.frontend.pid ]; then
        kill $(cat frontend/trading-ui/.frontend.pid) 2>/dev/null
        rm frontend/trading-ui/.frontend.pid
    fi
    
    # 停止数据库服务
    brew services stop postgresql@15
    brew services stop redis
    
    print_message "所有服务已停止"
}

# 设置清理钩子
trap cleanup EXIT

# 主函数
main() {
    cd "$(dirname "$0")"
    check_python_version
    install_system_deps
    setup_venv
    setup_postgresql
    setup_redis
    setup_env
    install_project
    run_migrations
    run_tests
    start_app
}

main
