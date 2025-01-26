#!/bin/bash

# Exit on error
set -e

# Function to log messages
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log "Please run as root or with sudo"
    exit 1
}

# Check required environment variables
if [ -z "$DEEPSEEK_API_KEY" ] || [ -z "$BINANCE_API_KEY" ] || [ -z "$BINANCE_API_SECRET" ]; then
    log "Error: Required environment variables not set"
    log "Please set: DEEPSEEK_API_KEY, BINANCE_API_KEY, BINANCE_API_SECRET"
    exit 1
}

log "Starting installation..."

# Install system dependencies
log "Installing system dependencies..."
apt-get update && apt-get install -y \
    python3.11 python3.11-venv python3.11-dev \
    build-essential libssl-dev libffi-dev \
    sqlite3 redis-server nginx \
    docker.io docker-compose

# Enable and start Docker
log "Configuring Docker..."
systemctl enable docker
systemctl start docker

# Get script directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"
INSTALL_DIR="/opt/tradingbot"

# Create installation directory structure
log "Setting up project structure..."
mkdir -p $INSTALL_DIR
cp -r $PROJECT_ROOT/* $INSTALL_DIR/

# Setup Python virtual environment
log "Setting up Python virtual environment..."
cd $INSTALL_DIR
python3.11 -m venv venv
source venv/bin/activate

# Install Python dependencies for each component
log "Installing Python dependencies..."
pip install --upgrade pip
components=("api_gateway" "defi_agent" "trading_agent")
for component in "${components[@]}"; do
    if [ -f "src/$component/requirements.txt" ]; then
        log "Installing dependencies for $component..."
        pip install -r "src/$component/requirements.txt"
    fi
done

# Configure environment variables
log "Configuring environment variables..."
components=("api_gateway" "defi_agent" "trading_agent")
for component in "${components[@]}"; do
    if [ -f "src/$component/config/.env.example" ]; then
        cp "src/$component/config/.env.example" "src/$component/config/.env"
        sed -i "s/DEEPSEEK_API_KEY=.*/DEEPSEEK_API_KEY=$DEEPSEEK_API_KEY/" "src/$component/config/.env"
        sed -i "s/BINANCE_API_KEY=.*/BINANCE_API_KEY=$BINANCE_API_KEY/" "src/$component/config/.env"
        sed -i "s/BINANCE_API_SECRET=.*/BINANCE_API_SECRET=$BINANCE_API_SECRET/" "src/$component/config/.env"
    fi
done

# Setup Nginx
log "Configuring Nginx..."
cat > /etc/nginx/sites-available/tradingbot <<EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

ln -sf /etc/nginx/sites-available/tradingbot /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Setup systemd services
log "Configuring systemd services..."

# API Gateway Service
cat > /etc/systemd/system/tradingbot-api.service <<EOF
[Unit]
Description=Trading Bot API Gateway
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR/src/api_gateway
Environment=PATH=$INSTALL_DIR/venv/bin:\$PATH
ExecStart=$INSTALL_DIR/venv/bin/python -m app.main
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Trading Agent Service
cat > /etc/systemd/system/tradingbot-agent.service <<EOF
[Unit]
Description=Trading Bot Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR/src/trading_agent/python
Environment=PATH=$INSTALL_DIR/venv/bin:\$PATH
ExecStart=$INSTALL_DIR/venv/bin/python main.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# DeFi Agent Service
cat > /etc/systemd/system/tradingbot-defi.service <<EOF
[Unit]
Description=Trading Bot DeFi Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR/src/defi_agent/python
Environment=PATH=$INSTALL_DIR/venv/bin:\$PATH
ExecStart=$INSTALL_DIR/venv/bin/python defi_ai_agent.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Setup monitoring
log "Setting up monitoring..."
mkdir -p /etc/prometheus
cp src/deployment/monitoring/prometheus/prometheus.yml /etc/prometheus/

# Enable and start services
log "Starting services..."
systemctl daemon-reload
services=("tradingbot-api" "tradingbot-agent" "tradingbot-defi")
for service in "${services[@]}"; do
    systemctl enable $service
    systemctl start $service
done

# Setup frontend
log "Setting up frontend..."
cd $INSTALL_DIR/src/frontend
npm install
npm run build

log "Installation completed successfully!"
log "You can now access:"
log "- Frontend: http://localhost:3000"
log "- API: http://localhost:8000"
log "- Monitoring: http://localhost:9090"

exit 0
