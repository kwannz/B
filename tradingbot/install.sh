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

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root"
    exit 1
fi

# 检查操作系统
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VER=$VERSION_ID
else
    print_error "Cannot detect OS"
    exit 1
fi

print_message "Installing on $OS $VER"

# 安装基本系统依赖
print_message "Installing system dependencies..."
apt-get update
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    build-essential \
    python3-dev \
    python3-pip \
    libssl-dev \
    libffi-dev \
    postgresql-client \
    libpq-dev \
    gcc \
    g++ \
    make \
    wget

# 安装Docker
print_message "Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    systemctl enable docker
    systemctl start docker
else
    print_warning "Docker already installed"
fi

# 安装Docker Compose
print_message "Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/download/v2.23.3/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
else
    print_warning "Docker Compose already installed"
fi

# 创建必要的目录
print_message "Creating directories..."
mkdir -p /opt/tradingbot/{config,logs,backups}
chmod -R 755 /opt/tradingbot

# 生成加密密钥
print_message "Generating encryption keys..."
if [ ! -f /opt/tradingbot/config/master.key ]; then
    openssl rand -hex 32 > /opt/tradingbot/config/master.key
    chmod 600 /opt/tradingbot/config/master.key
fi

# 配置环境变量
print_message "Setting up environment variables..."
if [ ! -f .env ]; then
    cp .env.example .env
    # 生成随机密码
    REDIS_PASSWORD=$(openssl rand -hex 16)
    GRAFANA_PASSWORD=$(openssl rand -hex 16)
    # 更新.env文件
    sed -i "s/REDIS_PASSWORD=.*/REDIS_PASSWORD=$REDIS_PASSWORD/" .env
    sed -i "s/GRAFANA_PASSWORD=.*/GRAFANA_PASSWORD=$GRAFANA_PASSWORD/" .env
fi

# 配置系统限制
print_message "Configuring system limits..."
cat > /etc/security/limits.d/tradingbot.conf << EOF
*         soft    nofile      65536
*         hard    nofile      65536
*         soft    nproc       65536
*         hard    nproc       65536
EOF

# 配置系统参数
cat > /etc/sysctl.d/99-tradingbot.conf << EOF
net.core.somaxconn = 65536
net.ipv4.tcp_max_syn_backlog = 65536
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_fin_timeout = 30
EOF
sysctl --system

# 启动服务
print_message "Starting services..."
docker-compose -f docker-compose.prod.yml up -d

# 等待服务启动
print_message "Waiting for services to start..."
sleep 30

# 检查服务健康状态
print_message "Checking service health..."
if curl -s http://localhost:8000/health > /dev/null; then
    print_message "API Gateway is running"
else
    print_error "API Gateway is not responding"
fi

if curl -s http://localhost:8001/health > /dev/null; then
    print_message "Trading Agent is running"
else
    print_error "Trading Agent is not responding"
fi

if curl -s http://localhost:3000/api/health > /dev/null; then
    print_message "Grafana is running"
else
    print_error "Grafana is not responding"
fi

print_message "Installation completed!"
print_message "Grafana dashboard: http://localhost:3000 (admin/admin)"
print_message "API documentation: http://localhost:8000/docs"
print_message "Please change default passwords in production environment!"