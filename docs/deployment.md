# TradingBot Deployment Guide

## System Requirements
- Go: 1.22.0 or later
- Python: 3.11.11
- MongoDB: 7.0.16 or later
- Redis Server (latest stable)
- PostgreSQL (latest stable)

## Vendor Directory Management
### Go Dependencies
- Use `go mod vendor` to manage Go dependencies
- Keep vendor/ at project root
- Only commit go.mod and go.sum
- Add to .gitignore: `vendor/*` and `!vendor/modules.txt`

### Python Dependencies
- Use Python virtual environment (venv/)
- Generate requirements.txt for dependencies
- Add venv/ to .gitignore

## Service Configuration
Current service versions and configurations:

### Database Services
- MongoDB: v7.0.16
  - Status: Active and responding
  - Port: 27017
  - Connection string: `mongodb://localhost:27017`

- Redis: Latest stable
  - Status: Active (systemd managed)
  - Port: 6379
  - Connection string: `redis://localhost:6379/0`

- PostgreSQL: Latest stable
  - Status: Configuration required
  - Port: 5432
  - Database: tradingbot
  - User: admin
  - Note: Password configuration needed

### API Services
- FastAPI Servers
  - Main API: Port 8000 (start with start_services.sh)
  - Monitoring API: Port 8001 (start with monitor.py)
  - WebSocket Service: Port 8001/ws

### API Services
- FastAPI Server: Running on port 8000
  - Status: Active
  - Endpoint: http://0.0.0.0:8000
  - Features:
    - Risk Management API
    - Monitoring System
    - Trading Operations

## Configuration Changes
1. Python Environment
   - Updated to Python 3.12
   - Migrated Pydantic models to V2
   - Updated regex validators to pattern validators
   - Configured type hints for better compatibility

2. Database Setup
   - MongoDB Community Edition 7.0
   - Redis Server with default configuration
   - PostgreSQL with tradingbot database

3. Code Structure Updates
   - Centralized PyObjectId handling in base.py
   - Added monitoring service
   - Enhanced risk management system
   - Updated API routers for better error handling

## Verification System
A comprehensive verification system has been implemented:
- Database connectivity checks
- Service port monitoring
- System health verification

## Required Python Packages
Key dependencies:
- fastapi==0.115.8
- motor==3.7.0
- aiohttp==3.11.12
- websockets==11.0.3
- redis==4.5.4
- psycopg2-binary==2.9.9
- pydantic==2.10.6
- uvicorn==0.21.0

## Service Startup
1. Start Backend Services:
```bash
cd src/backend
./start_services.sh
```

2. Start Monitoring:
```bash
cd src/backend
python monitor.py
```

3. Start Trading Service:
```bash
cd go-migration
go run cmd/tradingbot/main.go
```

## Monitoring Endpoints
- Health Check: http://localhost:8001/api/v1/health
- Metrics: http://localhost:8001/api/v1/jupiter-metrics
- WebSocket: ws://localhost:8001/ws
- Real-time Trade Data: ws://localhost:8001/ws/trades

## Service Startup Instructions

1. Start Backend Services:
```bash
cd src/backend
./start_services.sh
```

2. Start Monitoring:
```bash
cd src/backend
python monitor.py
```

3. Start Trading Service:
```bash
cd go-migration
go run cmd/tradingbot/main.go
```

## Service Verification
- Health Check: http://localhost:8001/api/v1/health
- Metrics: http://localhost:8001/api/v1/jupiter-metrics
- WebSocket: ws://localhost:8001/ws
- Real-time Trade Data: ws://localhost:8001/ws/trades

## Known Issues
- PostgreSQL requires password configuration
- Configure environment variables before starting services
- Ensure MongoDB is running before starting services

## Environment Variables

Required environment variables:

### Backend Configuration
```bash
# Database Configuration
MONGODB_URL=mongodb://localhost:27017
REDIS_URL=redis://localhost:6379/0
POSTGRES_URL=postgresql://admin@localhost:5432/tradingbot

# Trading Configuration
SOLANA_WALLET_KEY=<wallet-private-key>
GMGN_API_KEY=<api-key>

# Service Configuration
API_PORT=8000
MONITOR_PORT=8001
```

Copy `.env.example` to `.env` and update with your values. For Go services, copy `configs/secrets.yaml.example` to `configs/secrets.yaml`.

## Health Checks
The system includes built-in health checks:
- Database connectivity monitoring
- Service availability checks
- Performance metrics collection
- Alert system integration

## Monitoring
A comprehensive monitoring system is in place:
- System metrics collection
- Trading performance tracking
- Risk assessment monitoring
- Real-time alerts
