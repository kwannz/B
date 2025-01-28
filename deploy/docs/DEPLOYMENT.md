# Trading Bot Deployment Guide

## Quick Start
1. Clone the repository
2. Run ./deploy/scripts/install.sh
3. Configure environment variables in deploy/config/.env
4. Access services:
   - Frontend: http://localhost:3001
   - API Gateway: http://localhost:8000
   - Monitoring: http://localhost:3000

## Directory Structure
```
src/
  frontend/         # React trading dashboard
  backend/          # FastAPI services
    api_gateway/    # Main API endpoints
  shared/          # Shared utilities
    models/        # Data models
    strategies/    # Trading strategies
    sentiment/     # Sentiment analysis

deploy/
  docker/          # Docker configurations
  scripts/         # Deployment scripts
  config/          # Environment files
  docs/           # Documentation
```

## Prerequisites
- Docker and Docker Compose
- Node.js 20+
- Python 3.11+
