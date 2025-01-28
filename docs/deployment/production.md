# Production Deployment

## System Requirements
- 4+ CPU cores
- 8GB+ RAM
- 100GB+ SSD
- Ubuntu 20.04+

## Deployment Steps
1. Configure Environment
   ```bash
   cp config/production/.env.example .env
   ```

2. Deploy Services
   ```bash
   ./scripts/deploy.sh
   ```

3. Verify Deployment
   ```bash
   ./scripts/health_check.sh
   ```

## Monitoring
- Grafana: http://localhost:3000
- Prometheus: http://localhost:9090

## Backup & Recovery
See /docs/deployment/backup.md
