# 部署指南

## 系统要求

### 硬件要求
- CPU: 4核心以上
- 内存: 8GB以上
- 存储: 50GB以上SSD
- 网络: 高速稳定的网络连接

### 软件要求
- 操作系统: Ubuntu 20.04 LTS或更高版本
- Python 3.11+
- Go 1.21+
- Protocol Buffers
- tmux
- Supervisor (进程管理)
- Nginx (可选，用于API代理)

## 安装步骤

### 1. 系统准备

```bash
# 更新系统
sudo apt update
sudo apt upgrade -y

# 安装基础工具
sudo apt install -y git tmux supervisor nginx

# 创建应用目录
sudo mkdir -p /opt/tradingbot
sudo chown -R $(whoami):$(whoami) /opt/tradingbot
```

### 2. 克隆代码

```bash
cd /opt/tradingbot
git clone https://github.com/your-repo/tradingbot.git .
```

### 3. 安装依赖

```bash
# 运行安装脚本
chmod +x src/scripts/install_deps.sh
./src/scripts/install_deps.sh

# 初始化项目
chmod +x src/scripts/init_project.sh
./src/scripts/init_project.sh
```

### 4. 配置文件

1. 环境变量配置
```bash
# 复制示例配置
cp config/.env.example config/.env

# 编辑配置文件
vim config/.env
```

配置内容示例：
```env
# 生产环境配置
ENVIRONMENT=production

# Solana RPC URL
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# 交易参数
MIN_PROFIT_THRESHOLD=0.5
MAX_SLIPPAGE=1.0
TRADE_AMOUNT=1000000000
TRADING_INTERVAL_SECONDS=60

# 钱包配置
WALLET_A_ADDRESS=your_trading_wallet_address
WALLET_B_ADDRESS=your_profit_wallet_address

# AI配置
AI_CONFIDENCE_THRESHOLD=0.7
MIN_DATA_POINTS=10

# 风险管理
MAX_LOSS_PERCENTAGE=2.0
POSITION_SIZE_PERCENTAGE=10.0
MAX_EXPOSURE_PERCENTAGE=50.0
RISK_LEVEL=medium

# 日志配置
LOG_LEVEL=INFO
LOG_PATH=/opt/tradingbot/logs
```

2. Supervisor配置

```bash
# 创建Supervisor配置
sudo vim /etc/supervisor/conf.d/tradingbot.conf
```

配置内容：
```ini
[program:tradingbot-go]
command=/opt/tradingbot/bin/tradingbot
directory=/opt/tradingbot
user=tradingbot
autostart=true
autorestart=true
stderr_logfile=/opt/tradingbot/logs/go-error.log
stdout_logfile=/opt/tradingbot/logs/go-output.log
environment=
    ENVIRONMENT=production,
    PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

[program:tradingbot-python]
command=/opt/tradingbot/venv311/bin/python /opt/tradingbot/src/python/trading_ai.py
directory=/opt/tradingbot
user=tradingbot
autostart=true
autorestart=true
stderr_logfile=/opt/tradingbot/logs/python-error.log
stdout_logfile=/opt/tradingbot/logs/python-output.log
environment=
    ENVIRONMENT=production,
    PYTHONPATH=/opt/tradingbot
```

3. Nginx配置（可选）

```bash
# 创建Nginx配置
sudo vim /etc/nginx/sites-available/tradingbot
```

配置内容：
```nginx
server {
    listen 80;
    server_name trading.yourdomain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5. 服务启动

```bash
# 重新加载Supervisor配置
sudo supervisorctl reread
sudo supervisorctl update

# 启动服务
sudo supervisorctl start tradingbot-go
sudo supervisorctl start tradingbot-python

# 检查状态
sudo supervisorctl status
```

### 6. 日志管理

1. 配置日志轮转
```bash
sudo vim /etc/logrotate.d/tradingbot
```

配置内容：
```
/opt/tradingbot/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0640 tradingbot tradingbot
}
```

2. 查看日志
```bash
# 实时查看日志
tail -f /opt/tradingbot/logs/trading.log
tail -f /opt/tradingbot/logs/dex.log
tail -f /opt/tradingbot/logs/ai.log
```

## 监控设置

### 1. 系统监控

```bash
# 安装监控工具
sudo apt install -y prometheus node-exporter grafana

# 配置Prometheus
sudo vim /etc/prometheus/prometheus.yml
```

添加配置：
```yaml
scrape_configs:
  - job_name: 'tradingbot'
    static_configs:
      - targets: ['localhost:8080']
```

### 2. 告警设置

1. 创建告警规则
```bash
sudo vim /etc/prometheus/alerts.yml
```

配置内容：
```yaml
groups:
- name: tradingbot
  rules:
  - alert: HighErrorRate
    expr: rate(tradingbot_errors_total[5m]) > 0.1
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: High error rate detected
```

2. 配置告警通知
```bash
# 安装告警管理器
sudo apt install -y alertmanager

# 配置告警通知
sudo vim /etc/alertmanager/alertmanager.yml
```

## 备份策略

### 1. 数据备份

```bash
# 创建备份脚本
vim /opt/tradingbot/scripts/backup.sh
```

脚本内容：
```bash
#!/bin/bash

# 备份配置和数据
tar -czf /backup/tradingbot-$(date +%Y%m%d).tar.gz \
    /opt/tradingbot/config \
    /opt/tradingbot/wallets \
    /opt/tradingbot/logs

# 保留最近7天的备份
find /backup -name "tradingbot-*.tar.gz" -mtime +7 -delete
```

### 2. 设置定时任务

```bash
# 编辑crontab
crontab -e
```

添加定时任务：
```
0 0 * * * /opt/tradingbot/scripts/backup.sh
```

## 故障恢复

### 1. 服务恢复

```bash
# 重启服务
sudo supervisorctl restart tradingbot-go
sudo supervisorctl restart tradingbot-python

# 检查日志
tail -f /opt/tradingbot/logs/go-error.log
tail -f /opt/tradingbot/logs/python-error.log
```

### 2. 数据恢复

```bash
# 从备份恢复
cd /opt/tradingbot
tar -xzf /backup/tradingbot-YYYYMMDD.tar.gz

# 重启服务
sudo supervisorctl restart all
```

## 性能优化

### 1. 系统优化

```bash
# 调整系统限制
sudo vim /etc/security/limits.conf
```

添加配置：
```
tradingbot soft nofile 65535
tradingbot hard nofile 65535
```

### 2. 网络优化

```bash
# 优化TCP参数
sudo vim /etc/sysctl.conf
```

添加配置：
```
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_fin_timeout = 30
```

## 安全建议

1. 防火墙配置
```bash
# 只开放必要端口
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 50051/tcp  # gRPC端口
```

2. SSL证书配置
```bash
# 安装certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d trading.yourdomain.com
```

3. 访问控制
```bash
# 创建API密钥
openssl rand -base64 32 > /opt/tradingbot/config/api.key

# 配置访问控制
vim /opt/tradingbot/config/access.yml
# 部署指南

## 系统要求

### 硬件要求
- CPU: 4核心以上
- 内存: 8GB以上
- 存储: 50GB以上SSD
- 网络: 高速稳定的网络连接

### 软件要求
- 操作系统: Ubuntu 20.04 LTS或更高版本
- Python 3.11+
- Go 1.21+
- Protocol Buffers
- tmux
- Supervisor (进程管理)
- Nginx (可选，用于API代理)

## 安装步骤

### 1. 系统准备

```bash
# 更新系统
sudo apt update
sudo apt upgrade -y

# 安装基础工具
sudo apt install -y git tmux supervisor nginx

# 创建应用目录
sudo mkdir -p /opt/tradingbot
sudo chown -R $(whoami):$(whoami) /opt/tradingbot
```

### 2. 克隆代码

```bash
cd /opt/tradingbot
git clone https://github.com/your-repo/tradingbot.git .
```

### 3. 安装依赖

```bash
# 运行安装脚本
chmod +x src/scripts/install_deps.sh
./src/scripts/install_deps.sh

# 初始化项目
chmod +x src/scripts/init_project.sh
./src/scripts/init_project.sh
```

### 4. 配置文件

1. 环境变量配置
```bash
# 复制示例配置
cp config/.env.example config/.env

# 编辑配置文件
vim config/.env
```

配置内容示例：
```env
# 生产环境配置
ENVIRONMENT=production

# Solana RPC URL
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# 交易参数
MIN_PROFIT_THRESHOLD=0.5
MAX_SLIPPAGE=1.0
TRADE_AMOUNT=1000000000
TRADING_INTERVAL_SECONDS=60

# 钱包配置
WALLET_A_ADDRESS=your_trading_wallet_address
WALLET_B_ADDRESS=your_profit_wallet_address

# AI配置
AI_CONFIDENCE_THRESHOLD=0.7
MIN_DATA_POINTS=10

# 风险管理
MAX_LOSS_PERCENTAGE=2.0
POSITION_SIZE_PERCENTAGE=10.0
MAX_EXPOSURE_PERCENTAGE=50.0
RISK_LEVEL=medium

# 日志配置
LOG_LEVEL=INFO
LOG_PATH=/opt/tradingbot/logs
```

2. Supervisor配置

```bash
# 创建Supervisor配置
sudo vim /etc/supervisor/conf.d/tradingbot.conf
```

配置内容：
```ini
[program:tradingbot-go]
command=/opt/tradingbot/bin/tradingbot
directory=/opt/tradingbot
user=tradingbot
autostart=true
autorestart=true
stderr_logfile=/opt/tradingbot/logs/go-error.log
stdout_logfile=/opt/tradingbot/logs/go-output.log
environment=
    ENVIRONMENT=production,
    PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

[program:tradingbot-python]
command=/opt/tradingbot/venv311/bin/python /opt/tradingbot/src/python/trading_ai.py
directory=/opt/tradingbot
user=tradingbot
autostart=true
autorestart=true
stderr_logfile=/opt/tradingbot/logs/python-error.log
stdout_logfile=/opt/tradingbot/logs/python-output.log
environment=
    ENVIRONMENT=production,
    PYTHONPATH=/opt/tradingbot
```

3. Nginx配置（可选）

```bash
# 创建Nginx配置
sudo vim /etc/nginx/sites-available/tradingbot
```

配置内容：
```nginx
server {
    listen 80;
    server_name trading.yourdomain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5. 服务启动

```bash
# 重新加载Supervisor配置
sudo supervisorctl reread
sudo supervisorctl update

# 启动服务
sudo supervisorctl start tradingbot-go
sudo supervisorctl start tradingbot-python

# 检查状态
sudo supervisorctl status
```

### 6. 日志管理

1. 配置日志轮转
```bash
sudo vim /etc/logrotate.d/tradingbot
```

配置内容：
```
/opt/tradingbot/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0640 tradingbot tradingbot
}
```

2. 查看日志
```bash
# 实时查看日志
tail -f /opt/tradingbot/logs/trading.log
tail -f /opt/tradingbot/logs/dex.log
tail -f /opt/tradingbot/logs/ai.log
```

## 监控设置

### 1. 系统监控

```bash
# 安装监控工具
sudo apt install -y prometheus node-exporter grafana

# 配置Prometheus
sudo vim /etc/prometheus/prometheus.yml
```

添加配置：
```yaml
scrape_configs:
  - job_name: 'tradingbot'
    static_configs:
      - targets: ['localhost:8080']
```

### 2. 告警设置

1. 创建告警规则
```bash
sudo vim /etc/prometheus/alerts.yml
```

配置内容：
```yaml
groups:
- name: tradingbot
  rules:
  - alert: HighErrorRate
    expr: rate(tradingbot_errors_total[5m]) > 0.1
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: High error rate detected
```

2. 配置告警通知
```bash
# 安装告警管理器
sudo apt install -y alertmanager

# 配置告警通知
sudo vim /etc/alertmanager/alertmanager.yml
```

## 备份策略

### 1. 数据备份

```bash
# 创建备份脚本
vim /opt/tradingbot/scripts/backup.sh
```

脚本内容：
```bash
#!/bin/bash

# 备份配置和数据
tar -czf /backup/tradingbot-$(date +%Y%m%d).tar.gz \
    /opt/tradingbot/config \
    /opt/tradingbot/wallets \
    /opt/tradingbot/logs

# 保留最近7天的备份
find /backup -name "tradingbot-*.tar.gz" -mtime +7 -delete
```

### 2. 设置定时任务

```bash
# 编辑crontab
crontab -e
```

添加定时任务：
```
0 0 * * * /opt/tradingbot/scripts/backup.sh
```

## 故障恢复

### 1. 服务恢复

```bash
# 重启服务
sudo supervisorctl restart tradingbot-go
sudo supervisorctl restart tradingbot-python

# 检查日志
tail -f /opt/tradingbot/logs/go-error.log
tail -f /opt/tradingbot/logs/python-error.log
```

### 2. 数据恢复

```bash
# 从备份恢复
cd /opt/tradingbot
tar -xzf /backup/tradingbot-YYYYMMDD.tar.gz

# 重启服务
sudo supervisorctl restart all
```

## 性能优化

### 1. 系统优化

```bash
# 调整系统限制
sudo vim /etc/security/limits.conf
```

添加配置：
```
tradingbot soft nofile 65535
tradingbot hard nofile 65535
```

### 2. 网络优化

```bash
# 优化TCP参数
sudo vim /etc/sysctl.conf
```

添加配置：
```
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_fin_timeout = 30
```

## 安全建议

1. 防火墙配置
```bash
# 只开放必要端口
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 50051/tcp  # gRPC端口
```

2. SSL证书配置
```bash
# 安装certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d trading.yourdomain.com
```

3. 访问控制
```bash
# 创建API密钥
openssl rand -base64 32 > /opt/tradingbot/config/api.key

# 配置访问控制
vim /opt/tradingbot/config/access.yml
