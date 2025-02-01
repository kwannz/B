# Trading Bot Deployment Guide

This guide explains how to deploy the Trading Bot system, including both frontend and backend components.

## Prerequisites

- Python 3.11 or higher
- Node.js 16 or higher
- PostgreSQL database
- Redis (for caching)
- Solana CLI tools

## Environment Variables

Create a `.env` file in the `config` directory:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/tradingbot

# Solana
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
MIN_SOL_BALANCE=0.5
TX_FEE_RESERVE=0.1

# DeepSeek AI
DEEPSEEK_API_KEY=your_api_key
DEEPSEEK_API_URL=https://api.deepseek.com/v1

# Web Server
PORT=8000
MONITOR_PORT=8001
```

## Backend Setup

1. Create Python virtual environment:
```bash
python3.11 -m venv venv
source venv/bin/activate
```

2. Install dependencies:
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

3. Initialize database:
```bash
python manage.py migrate
```

4. Configure Supervisor:
```bash
sudo cp config/supervisor.conf /etc/supervisor/conf.d/tradingbot.conf
sudo supervisorctl reread
sudo supervisorctl update
```

5. Configure Nginx:
```bash
sudo cp config/nginx.conf /etc/nginx/sites-available/tradingbot
sudo ln -s /etc/nginx/sites-available/tradingbot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Frontend Setup

1. Install Node.js dependencies:
```bash
cd src/frontend
npm install
```

2. Build frontend:
```bash
npm run build
```

3. Configure frontend environment:
Create `.env` file in `src/frontend`:
```bash
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000/ws
```

## Starting Services

1. Start backend services:
```bash
sudo supervisorctl start tradingbot:*
```

2. Verify services:
```bash
sudo supervisorctl status
```

## Monitoring

Access the dashboards at:
- Trading Dashboard: http://localhost:8000
- Monitoring Dashboard: http://localhost:8001

## Security Notes

1. Wallet Security:
   - Minimum balance of 0.5 SOL required
   - 10% transaction fee reserve enforced
   - Private keys stored securely

2. API Security:
   - Rate limiting enabled
   - CORS configured
   - SSL/TLS required in production

## Troubleshooting

1. Check logs:
```bash
sudo tail -f /var/log/tradingbot/error.log
sudo tail -f /var/log/tradingbot/access.log
```

2. Restart services:
```bash
sudo supervisorctl restart tradingbot:*
```

3. Common issues:
   - Database connection errors: Check PostgreSQL service
   - Solana RPC errors: Verify RPC endpoint and network status
   - DeepSeek API errors: Validate API key and rate limits
