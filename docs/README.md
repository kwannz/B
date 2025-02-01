# TradingBot Configuration System

A comprehensive configuration and monitoring system for the TradingBot platform, featuring DeepSeek AI integration, real-time monitoring, and advanced trading capabilities.

## Features

- **Configuration Management**
  - Environment-based configuration
  - Hot-reloading support
  - Validation and type checking
  - Secure secrets handling

- **Trading Features**
  - Solana mainnet trading support
  - Jupiter DEX integration
  - Real-time market analysis
  - Dynamic trading strategies
  - Automated risk management
  - Multi-tenant support
  - Rate limiting and backoff

- **Monitoring & Alerting**
  - Real-time metrics
  - Custom alert rules
  - Multi-channel notifications
  - Performance tracking

- **Database Integration**
  - PostgreSQL with async support
  - Redis caching
  - Automated backups
  - Data persistence
  - Transaction support

## Prerequisites

- Python 3.11+
- Docker and Docker Compose
- PostgreSQL 15+
- Redis 7.0+

## Quick Start

### 自动安装（推荐）

1. 克隆仓库并进入目录：
```bash
git clone https://github.com/yourusername/tradingbot.git
cd tradingbot
```

2. 运行安装脚本：
```bash
chmod +x install.sh
sudo ./install.sh
```

安装脚本会自动：
- 安装所有系统依赖
- 配置Docker和Docker Compose
- 设置必要的环境变量
- 创建所需目录和密钥
- 启动所有服务
- 验证服务健康状态

### 本地运行（不使用Docker）

如果您想在本地环境中运行系统而不使用Docker，可以使用本地运行脚本：

1. 确保您的系统满足以下要求：
   - Python 3.11或更高版本
   - PostgreSQL 15
   - Redis 7.0

2. 运行本地安装脚本：
```bash
chmod +x run_local.sh
./run_local.sh
```

脚本会自动：
- 检查并安装系统依赖
- 创建Python虚拟环境
- 安装所需的Python包
- 配置PostgreSQL和Redis
- 运行数据库迁移
- 启动所有必要的服务
## Configuration Structure

### Core Configuration
- `config/api.py`: API settings and external service configuration
- `config/database.py`: PostgreSQL and Redis configuration
- `config/trading.py`: Trading parameters and risk management
- `config/monitoring.py`: Metrics and alerting settings
- `config/settings.py`: Global settings management

### Trading Strategies

1. DEX Strategy
   - Market making on Jupiter DEX
   - Configurable spread and depth
   - Dynamic fee adjustment
   - Auto-rebalancing
   ```env
   TRADING_MODE=both  # both, buy_only, sell_only
   MIN_PROFIT_THRESHOLD=0.5
   TRADING_INTERVAL_SECONDS=60
   ```

2. Solana Meme Strategy
   - Momentum-based trading
   - Volume analysis
   - Trend following
   - Risk-adjusted position sizing
   ```env
   RISK_LEVEL=medium  # low, medium, high
   MAX_POSITION_SIZE=10.0
   STOP_LOSS_PERCENTAGE=5.0
   ```

3. Technical Analysis
   - Moving averages
   - RSI-based signals
   - Volume analysis
   - Trend detection
   ```env
   MA_SHORT_PERIOD=10
   MA_LONG_PERIOD=20
   RSI_PERIOD=14
   RSI_OVERBOUGHT=70
   RSI_OVERSOLD=30
   ```

### Environment Variables
```env
# Network Configuration
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
JUPITER_API_URL=https://quote-api.jup.ag/v6

# Database Configuration
DATABASE_URL=postgresql+asyncpg://tradingbot:tradingbot@postgres:5432/tradingbot
REDIS_URL=redis://redis:6379/0

# Service URLs
TRADING_SERVICE_URL=http://trading_agent:8001
MARKET_DATA_SERVICE_URL=http://market_data:8002

# Security Configuration
JWT_SECRET=your_jwt_secret_here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Rate Limiting
RATE_LIMIT_PER_SECOND=10
MAX_REQUESTS_PER_IP=1000
```

## Docker Services

- **API Gateway**: FastAPI application (port 8000)
- **Trading Agent**: Trading service (port 8001)
- **Frontend**: Web interface (ports 80, 443)
- **PostgreSQL**: Database (port 5432)
- **Redis**: Caching (port 6379)
- **Prometheus**: Metrics collection (port 9090)
- **Grafana**: Monitoring dashboard (port 3000)
- **AlertManager**: Alert handling (port 9093)

Each service includes health check endpoints and automatic recovery.

## Management Scripts

### Docker Management
```bash
./scripts/manage_docker.sh [command]

Commands:
  start       - Start all services
  stop        - Stop all services
  restart     - Restart all services
  status      - Show status of all services
  logs        - Show logs of all services
  clean       - Remove all containers and volumes
  rebuild     - Rebuild and restart services
  verify      - Run verification checks
  update      - Update Docker images
  backup      - Backup MongoDB data
  restore     - Restore MongoDB data
```

## Monitoring & Metrics

### Trading Metrics
- Real-time P&L tracking
- Position monitoring
- Trade execution latency
- Slippage analysis
- Win/loss ratios
- Risk exposure metrics
- Volume analysis

### System Metrics
- Service health checks
- API response times
- Database performance
- Cache hit rates
- Memory usage
- CPU utilization
- Network latency

### Grafana Dashboards
1. Trading Overview
   - Real-time P&L
   - Active positions
   - Recent trades
   - Market indicators
   - Risk metrics

2. System Health
   - Service status
   - Resource usage
   - Error rates
   - Response times
   - Database metrics

3. Performance Analytics
   - Strategy performance
   - Execution quality
   - Market impact
   - Trading costs
   - Risk-adjusted returns

### Alerting Configuration
1. Trading Alerts
   - Large position changes
   - Unusual slippage
   - Risk limit breaches
   - Strategy deviations
   - Balance thresholds

2. System Alerts
   - Service health issues
   - High error rates
   - Resource constraints
   - API rate limits
   - Database problems

3. Alert Channels
   - Email notifications
   - Slack integration
   - Telegram alerts
   - Discord notifications
   - Webhook support

## Development

### Local Setup
1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or
.\venv\Scripts\activate  # Windows
```

2. Install dependencies:
```bash
pip install -r requirements.consolidated.txt
```

3. Configure environment:
```bash
cp config/.env.example config/.env
# Edit .env with your settings
```

4. Run tests:
```bash
# Run all tests
pytest tests/

# Test specific components
python scripts/verify_solana.py  # Test Solana SDK
python scripts/test_testnet_trading.py  # Test trading on testnet
python scripts/test_mainnet_trading.py  # Test trading on mainnet
```

### Development Guidelines
- Use testnet for initial development and testing
- Implement proper error handling and logging
- Follow rate limiting guidelines for external APIs
- Add health check endpoints for new services
- Update Docker configurations as needed

## Production Deployment

### Testnet Deployment
1. Update testnet settings in `.env`:
```bash
cp config/.env.example config/.env
# Edit .env and set:
# - ENABLE_TESTNET=true
# - SOLANA_RPC_URL=https://api.testnet.solana.com
```

2. Verify testnet functionality:
```bash
python scripts/test_testnet_trading.py
```

### Mainnet Deployment
1. Update mainnet settings in `.env.prod`:
```bash
cp .env.example .env.prod
# Edit .env.prod and set:
# - SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
# - JUPITER_API_URL=https://quote-api.jup.ag/v6
```

2. Verify mainnet functionality:
```bash
python scripts/test_mainnet_trading.py
```

3. Deploy with Docker:
```bash
# Build and start services
DOCKER_BUILDKIT=1 docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Verify health checks
curl http://localhost:8000/health  # API Gateway
curl http://localhost:8001/health  # Trading Agent
curl http://localhost/health       # Frontend
```

4. Monitor logs:
```bash
docker-compose -f docker-compose.prod.yml logs -f
```

## Backup and Restore

### Create Backup
```bash
# Backup PostgreSQL database
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U tradingbot tradingbot > backup_$(date +%Y%m%d).sql

# Backup Redis data
docker-compose -f docker-compose.prod.yml exec redis redis-cli SAVE
```

### Restore from Backup
```bash
# Restore PostgreSQL database
cat backup_20250123.sql | docker-compose -f docker-compose.prod.yml exec -T postgres psql -U tradingbot tradingbot

# Restore Redis data
docker cp dump.rdb tradingbot_redis_1:/data/dump.rdb
docker-compose -f docker-compose.prod.yml restart redis
```

## Security Considerations

### Authentication & Authorization
- JWT-based authentication
- Role-based access control
- API key management
- Multi-tenant isolation
- Session management

### Network Security
- SSL/TLS encryption in production
- Rate limiting and DDoS protection
- IP whitelisting support
- Secure WebSocket connections
- Health check endpoints

### Data Security
- Encrypted environment variables
- Secure key storage
- Database encryption at rest
- Audit logging
- Regular security updates

### Trading Security
- Transaction signing validation
- Slippage protection
- Risk management limits
- Balance verification
- Rate limiting for DEX interactions

## Troubleshooting

### Common Issues

1. Connection Issues
```bash
# Check service health
curl http://localhost:8000/health  # API Gateway
curl http://localhost:8001/health  # Trading Agent
curl http://localhost/health       # Frontend

# View service logs
docker-compose -f docker-compose.prod.yml logs -f api_gateway
docker-compose -f docker-compose.prod.yml logs -f trading_agent
```

2. Database Issues
```bash
# Check database connection
docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U tradingbot

# View database logs
docker-compose -f docker-compose.prod.yml logs -f postgres
```

3. Trading Issues
```bash
# Verify Solana connection
python scripts/verify_solana.py

# Test trading functionality
python scripts/test_mainnet_trading.py
```

### Logging

Log files are stored in `/opt/tradingbot/logs/`:
- `api.log`: API Gateway logs
- `trading.log`: Trading Agent logs
- `dex.log`: DEX interaction logs
- `error.log`: Error logs

Log levels can be configured in `.env`:
```env
LOG_LEVEL=DEBUG  # DEBUG, INFO, WARNING, ERROR
```

### Debugging

1. Enable debug mode:
```env
DEBUG=1
LOG_LEVEL=DEBUG
```

2. Monitor real-time logs:
```bash
tail -f /opt/tradingbot/logs/*.log
```

3. Use Grafana for visualization:
- Access Grafana at http://localhost:3000
- View trading metrics dashboard
- Check system metrics
- Monitor error rates

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests:
```bash
# Run all tests
pytest tests/

# Test specific components
python scripts/verify_solana.py
python scripts/test_testnet_trading.py
python scripts/test_mainnet_trading.py
```
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

# Documentation

## 目录说明
该目录用于存放项目文档。

## 目录结构
```
docs/
├── api/           # API文档
├── deployment/    # 部署文档
└── development/   # 开发文档
```

## 文档类型
1. API文档
   - RESTful API接口说明
   - WebSocket接口说明
   - gRPC服务定义
   
2. 部署文档
   - 环境要求
   - 部署步骤
   - 配置说明
   - 监控告警
   
3. 开发文档
   - 架构设计
   - 开发规范
   - 工作流程
   - 测试规范

## 文档规范
1. 使用Markdown格式
2. 保持文档的及时更新
3. 图文并茂，清晰易懂
4. 版本号与代码同步

## 文档更新
1. 功能变更同步更新文档
2. 定期检查文档有效性
3. 收集用户反馈改进
4. 保持多语言文档同步

## 最佳实践
1. 使用自动化工具生成API文档
2. 提供示例代码和用例
3. 添加故障排除指南
4. 包含变更日志
