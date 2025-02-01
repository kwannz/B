# 配置说明

本目录包含TradingBot的所有配置文件和配置管理工具。

## 📁 配置结构

```
config/
├── .env.example          # 环境变量示例
├── CONFIG.md            # 配置详细说明
├── constraints.txt      # 依赖约束
├── pyproject.toml      # Python项目配置
├── pytest.ini          # 测试配置
├── docker/             # Docker配置
│   ├── docker-compose.dev.yml   # 开发环境
│   ├── docker-compose.prod.yml  # 生产环境
│   └── scripts/                 # Docker脚本
├── prometheus/         # 监控配置
│   └── prometheus.yml  # Prometheus配置
└── strategies/         # 策略配置
```

## ⚙️ 配置类型

### 1. 环境变量 (.env)

关键配置项:
```bash
# API配置
API_HOST=localhost
API_PORT=8000
API_DEBUG=false

# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tradingbot
DB_USER=admin
DB_PASSWORD=secret

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# 模型配置
MODEL_PROVIDER=ollama
MODEL_NAME=deepseek
MODEL_VERSION=r1-1.5b

# 监控配置
PROMETHEUS_PORT=9090
GRAFANA_PORT=3000

# 安全配置
JWT_SECRET=your-secret-key
ENCRYPTION_KEY=your-encryption-key
```

### 2. Docker配置

#### 开发环境 (docker-compose.dev.yml)
```yaml
version: '3.8'
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "8000:8000"
    volumes:
      - ../src:/app/src
    environment:
      - ENV=development

  frontend:
    build:
      context: ../frontend
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - ../frontend:/app
```

#### 生产环境 (docker-compose.prod.yml)
```yaml
version: '3.8'
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.prod
    ports:
      - "8000:8000"
    environment:
      - ENV=production
```

### 3. 监控配置 (prometheus.yml)
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'tradingbot'
    static_configs:
      - targets: ['localhost:8000']
```

### 4. 测试配置 (pytest.ini)
```ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = -v --cov=src
```

## 🔧 配置管理

### 1. 环境变量管理

```bash
# 开发环境
cp .env.example .env.development
# 编辑开发环境变量

# 生产环境
cp .env.example .env.production
# 编辑生产环境变量

# 测试环境
cp .env.example .env.test
# 编辑测试环境变量
```

### 2. 配置验证

```bash
# 验证环境变量
./scripts/verify_env.py

# 验证配置文件
./scripts/verify_config.py
```

### 3. 配置更新

```bash
# 更新依赖约束
./scripts/update_constraints.sh

# 更新Docker配置
./scripts/update_docker_config.sh
```

## 🔒 安全配置

### 1. 密钥管理
- 使用环境变量存储敏感信息
- 加密存储API密钥
- 定期轮换密钥

### 2. 访问控制
```yaml
# 权限配置
permissions:
  admin:
    - all
  user:
    - read
    - execute
  guest:
    - read
```

### 3. 网络安全
```yaml
# 网络配置
network:
  allowed_hosts:
    - localhost
    - 127.0.0.1
  cors_origins:
    - http://localhost:3000
```

## 📊 性能配置

### 1. 缓存配置
```yaml
# Redis缓存配置
cache:
  ttl: 3600
  max_size: 1000
  eviction: lru
```

### 2. 数据库配置
```yaml
# 数据库连接池
database:
  pool_size: 20
  max_overflow: 10
  pool_timeout: 30
```

### 3. API限流
```yaml
# 限流配置
rate_limit:
  requests: 100
  period: 60
```

## 🚀 部署配置

### 1. 开发环境
```bash
# 启动开发环境
docker-compose -f docker/docker-compose.dev.yml up
```

### 2. 生产环境
```bash
# 启动生产环境
docker-compose -f docker/docker-compose.prod.yml up
```

### 3. 测试环境
```bash
# 启动测试环境
docker-compose -f docker/docker-compose.test.yml up
```

## 📝 配置最佳实践

1. 环境变量
- 使用.env文件管理
- 不提交敏感信息
- 提供示例配置

2. 配置文件
- 按环境分离
- 使用版本控制
- 提供详细注释

3. 安全性
- 加密敏感信息
- 限制访问权限
- 定期审查配置

4. 维护性
- 保持配置简单
- 提供配置文档
- 自动化配置管理

## 🔍 故障排除

### 常见问题

1. 配置加载失败
```bash
# 检查配置文件
./scripts/verify_config.py

# 验证环境变量
./scripts/verify_env.py
```

2. 权限问题
```bash
# 检查文件权限
chmod 600 .env
chmod 600 *.key
```

3. 连接问题
```bash
# 测试数据库连接
./scripts/test_db_connection.py

# 测试Redis连接
./scripts/test_redis_connection.py
