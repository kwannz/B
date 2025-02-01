# Trading Bot 部署和运维指南

## 目录
1. [系统要求](#系统要求)
2. [环境准备](#环境准备)
3. [部署步骤](#部署步骤)
4. [配置管理](#配置管理)
5. [监控告警](#监控告警)
6. [版本管理](#版本管理)
7. [故障处理](#故障处理)
8. [运维操作](#运维操作)

## 系统要求

### 硬件要求
- CPU: 8核心及以上
- 内存: 16GB及以上
- 磁盘: 100GB SSD
- 网络: 千兆以太网

### 软件要求
- 操作系统: Ubuntu 20.04 LTS或更高版本
- Go 1.21或更高版本
- Redis 7.0或更高版本
- NATS 2.9或更高版本
- Docker 24.0或更高版本
- Docker Compose 2.20或更高版本

## 环境准备

### 1. 安装Go
```bash
wget https://go.dev/dl/go1.21.0.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.21.0.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc
```

### 2. 安装Redis
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

### 3. 安装NATS
```bash
# 使用Docker安装NATS
docker pull nats:latest
docker run -d --name nats-server -p 4222:4222 -p 8222:8222 nats
```

### 4. 安装Docker和Docker Compose
```bash
# 安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

## 部署步骤

### 1. 获取代码
```bash
git clone https://github.com/your-org/trading-bot.git
cd trading-bot
```

### 2. 构建服务
```bash
# 构建Go服务
cd src/go_executor
go mod tidy
go build -o trading-bot

# 构建Docker镜像
docker build -t trading-bot:latest .
```

### 3. 配置服务
```bash
# 复制配置模板
cp config.example.yaml config.yaml

# 编辑配置文件
vim config.yaml
```

### 4. 启动服务
```bash
# 使用Docker Compose启动
docker-compose up -d

# 或直接启动二进制
./trading-bot -config config.yaml
```

## 配置管理

### 配置文件结构
```yaml
server:
  port: 8080
  debug: false

redis:
  url: "redis://localhost:6379/0"
  pool_size: 10

nats:
  url: "nats://localhost:4222"
  max_reconnects: -1
  reconnect_wait: 1s

risk:
  max_position_size: 100000.0
  max_drawdown: 0.1
  max_leverage: 3.0
  min_margin_level: 1.5

monitoring:
  collect_interval: 10s
  retention_period: 24h
  alerts_channel: "trading:alerts"
  metrics_channel: "trading:metrics"

versioning:
  metrics_interval: 10s
  validation_interval: 1m
  error_threshold: 0.01
  latency_threshold: 100
```

### 环境变量
可以使用环境变量覆盖配置文件中的设置：
```bash
export TRADING_SERVER_PORT=8081
export TRADING_REDIS_URL="redis://redis.example.com:6379/0"
export TRADING_NATS_URL="nats://nats.example.com:4222"
```

## 监控告警

### 监控指标
1. 系统指标
   - CPU使用率
   - 内存使用率
   - 磁盘I/O
   - 网络流量

2. 业务指标
   - 订单处理速率
   - 订单成功率
   - 平均响应时间
   - 错误率

3. 风控指标
   - 持仓规模
   - 杠杆率
   - 保证金水平
   - 未实现盈亏

### 告警规则
1. 系统告警
   - CPU使用率 > 80%
   - 内存使用率 > 85%
   - 磁盘使用率 > 90%

2. 业务告警
   - 错误率 > 1%
   - P99延迟 > 100ms
   - 订单拒绝率 > 5%

3. 风控告警
   - 接近持仓限制
   - 接近杠杆限制
   - 保证金水平过低

### 告警通道
1. 邮件通知
2. Slack通知
3. 短信通知
4. 电话通知（严重告警）

## 版本管理

### 版本发布流程
1. 特性分支开发
2. 代码审查
3. 测试环境部署
4. QA验证
5. 预发布环境部署
6. 生产环境灰度发布
7. 全量发布

### 灰度发布策略
1. 准备阶段
   - 部署新版本
   - 配置双版本并行
   - 设置监控指标

2. 灰度阶段
   - 流量切分（5% -> 20% -> 50% -> 100%）
   - 监控指标对比
   - 错误率监控

3. 切换阶段
   - 验证新版本稳定性
   - 完全切换流量
   - 下线旧版本

### 回滚策略
1. 触发条件
   - 错误率超过阈值
   - 性能下降明显
   - 发现严重bug

2. 回滚步骤
   - 切回旧版本流量
   - 下线新版本
   - 恢复配置
   - 通知相关人员

## 故障处理

### 常见问题
1. 服务无法启动
   - 检查配置文件
   - 检查依赖服务
   - 检查系统资源
   - 查看错误日志

2. 性能问题
   - 检查系统负载
   - 检查数据库性能
   - 检查网络连接
   - 分析慢查询

3. 连接问题
   - 检查网络连通性
   - 检查防火墙设置
   - 检查服务状态
   - 检查配置参数

### 故障恢复流程
1. 发现问题
   - 监控告警
   - 用户反馈
   - 运维巡检

2. 问题定位
   - 收集日志
   - 分析监控
   - 复现问题
   - 确定根因

3. 解决问题
   - 制定方案
   - 评估风险
   - 实施修复
   - 验证结果

4. 复盘总结
   - 记录过程
   - 分析原因
   - 优化改进
   - 更新文档

## 运维操作

### 日常运维
1. 日志管理
   ```bash
   # 查看服务日志
   docker logs -f trading-bot
   
   # 清理旧日志
   find /var/log/trading-bot -mtime +30 -delete
   ```

2. 备份管理
   ```bash
   # 备份配置
   cp config.yaml config.yaml.bak
   
   # 备份数据
   redis-cli save
   ```

3. 监控检查
   ```bash
   # 检查服务状态
   systemctl status trading-bot
   
   # 检查系统资源
   top
   df -h
   free -m
   ```

### 扩容操作
1. 增加节点
   ```bash
   # 部署新节点
   ansible-playbook deploy.yml -l new_nodes
   
   # 更新负载均衡
   ansible-playbook update-lb.yml
   ```

2. 配置更新
   ```bash
   # 更新配置
   ansible-playbook update-config.yml
   
   # 重启服务
   ansible-playbook restart-service.yml
   ```

### 应急操作
1. 服务降级
   ```bash
   # 开启降级模式
   curl -X POST http://localhost:8080/api/degradation/enable
   
   # 关闭非核心功能
   curl -X POST http://localhost:8080/api/features/disable
   ```

2. 快速回滚
   ```bash
   # 回滚版本
   docker-compose down
   docker image tag trading-bot:previous trading-bot:latest
   docker-compose up -d
   ```

3. 紧急修复
   ```bash
   # 应用热修复
   curl -X POST http://localhost:8080/api/hotfix/apply
   
   # 重启服务
   systemctl restart trading-bot
   ```
