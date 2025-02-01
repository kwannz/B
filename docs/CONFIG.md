# TradingBot Configuration Guide

## Core Components Configuration

### 1. Database Configuration
- MongoDB (≥6.0) required for raw/unstructured data
- Redis (≥7.0) required for caching and real-time data
- PostgreSQL for processed/structured data

### 2. API Keys Required
- DeepSeek AI API
  - DEEPSEEK_API_KEY
  - DEEPSEEK_API_URL
- Exchange APIs
  - OKXOS API credentials
  - Birdeye API credentials
  - Hyperliquid API credentials
- Blockchain APIs
  - Solana RPC URL
  - Jupiter DEX API

### 3. Trading Configuration
- Risk Management Settings
  - MIN_CONFIDENCE: 0.7 (default)
  - RISK_PER_TRADE: 0.02 (2% per trade)
  - MAX_DRAWDOWN: 0.1 (10%)
  - STOP_LOSS_MULTIPLIER: 2
  - TAKE_PROFIT_MULTIPLIER: 3

- Position Limits
  - MAX_POSITION_SIZE: 10000
  - MAX_LEVERAGE: 10
  - MIN_VOLUME: 1000000

### 4. Environment-Specific Settings
- Development Mode
  ```
  ENV=development
  LOG_LEVEL=INFO
  ENABLE_DEBUG=false
  ENABLE_TESTNET=true
  ENABLE_PAPER_TRADING=true
  ```

- Production Mode
  ```
  ENV=production
  LOG_LEVEL=INFO
  ENABLE_DEBUG=false
  ENABLE_TESTNET=false
  ENABLE_PAPER_TRADING=false
  ```

### 5. Security Configuration
- JWT Settings
  - JWT_SECRET (required)
  - JWT_ALGORITHM: HS256
  - JWT_ACCESS_TOKEN_EXPIRE_MINUTES: 30
  - JWT_REFRESH_TOKEN_EXPIRE_DAYS: 7

### 6. Monitoring Configuration
- Prometheus Port: 9090
- Grafana Port: 3000
- Metrics Collection Interval: 60s
- Dashboard Port: 8000

### 7. Notification Channels
- Telegram
  - TELEGRAM_BOT_TOKEN
  - TELEGRAM_CHAT_ID
- Discord
  - DISCORD_WEBHOOK_URL
- Email (Optional)
  - SMTP settings

## Component-Specific Configuration

### Trading Agent (.env)
```ini
# AI Configuration
DEEPSEEK_API_KEY=your_api_key
DEEPSEEK_API_URL=https://api.deepseek.com/v1
MIN_CONFIDENCE=0.7

# Solana Meme Trading
MIN_MEME_MARKET_CAP=100000
MIN_MEME_VOLUME=50000
MIN_MEME_HOLDERS=1000
MAX_MEME_RISK=0.7

# Risk Management
RISK_PER_TRADE=0.02
MAX_DRAWDOWN=0.1
STOP_LOSS_MULTIPLIER=2
TAKE_PROFIT_MULTIPLIER=3
```

### API Gateway (.env)
```ini
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tradingbot
DB_USER=postgres
DB_PASSWORD=postgres

# API Settings
API_HOST=0.0.0.0
API_PORT=8000
API_WORKERS=4
API_TIMEOUT=30
```

### Frontend (.env)
```ini
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000
REACT_APP_SESSION_TIMEOUT=3600
```

## Setup Instructions

1. Copy appropriate .env.example files:
   ```bash
   cp config/.env.example config/.env
   cp src/trading_agent/config/.env.example src/trading_agent/config/.env
   cp src/api_gateway/.env.example src/api_gateway/.env
   cp src/frontend/.env.example src/frontend/.env
   ```

2. Configure environment variables according to your needs

3. Required Services:
   - MongoDB ≥6.0
   - Redis ≥7.0
   - Python 3.11+ with SSL support
   - Node.js for frontend

4. Development Setup:
   ```bash
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

## Important Notes

1. Security:
   - Never commit .env files to version control
   - Rotate API keys regularly
   - Use strong JWT secrets
   - Enable rate limiting in production

2. Monitoring:
   - Configure alerts for critical metrics
   - Monitor system resources
   - Track trading performance

3. Backup:
   - Regular database backups
   - Secure key storage
   - Configuration backup
