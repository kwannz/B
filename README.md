# Trading Bot

A real-time trading bot application with a FastAPI backend and React frontend, supporting Solana trading platforms.

## Features

- Real-time trade execution and monitoring
- WebSocket-based live updates
- Solana wallet integration
- Performance metrics and analytics
- Customizable trading strategies
- PostgreSQL database for persistent storage
- GMGN DEX integration
- Real-time Solana trading
- Performance metrics and analytics

## Prerequisites

Before setting up the application, ensure you have the following installed:

- Python 3.11.11
- Go 1.22.0 or later
- MongoDB 7.0.16 or later
- Redis Server (latest stable)
- PostgreSQL (latest stable)
- Node.js 18.19.0 LTS
- npm 10.2.3
- Git
- GitHub CLI (for CI/CD setup)
- Solana CLI tools

## Quick Start

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd gotradingbot
   ```

2. Run the setup script:
   ```bash
   ./setup.sh
   ```
   This will:
   - Set up Python virtual environment
   - Install backend dependencies
   - Initialize the database
   - Install frontend dependencies
   - Create configuration files

3. Configure the application:
   - Backend configuration: `src/backend/.env`
   - Frontend configuration: `src/frontend/.env`

## API Documentation

### Market Data Endpoints
- `GET /v1/price/{dex}/{symbol}` - Get current price from specific DEX
- `GET /v1/history/{dex}/{symbol}` - Get historical price data
- `GET /api/v1/price/{symbol}` - Get current price from Pump.fun
- `GET /api/v1/historical/{symbol}` - Get historical price data from Pump.fun
- `GET /api/v1/gmgn/quote` - Get GMGN DEX quote
- `GET /api/v1/gmgn/status/{tx_hash}` - Get GMGN transaction status

### Trading Endpoints
- `POST /api/v1/orders` - Create new order
- `GET /api/v1/orders` - List all orders
- `GET /api/v1/orders/{order_id}` - Get specific order details
- `POST /api/v1/gmgn/swap` - Execute GMGN DEX swap
- `POST /api/v1/gmgn/bundle` - Submit GMGN bundle transaction

### Account Management
- `GET /api/v1/account/balance` - Get account balance
- `GET /api/v1/account/positions` - Get all positions

### Risk Management
- `GET /api/v1/risk/metrics` - Get risk metrics
- `GET /api/v1/risk/limits` - Get risk limit settings
- `POST /api/v1/risk/limits` - Update risk limit settings

### WebSocket Endpoints
- `/ws/market/{dex}` - Real-time market data stream
- `/ws/pump` - Real-time Pump.fun data stream
- `/ws/trades` - Real-time trade updates
- `/ws/positions` - Real-time position updates
- `/ws/orders` - Real-time order updates
- `/ws/risk` - Real-time risk metrics updates
- `/ws/gmgn` - Real-time GMGN DEX updates

For full API documentation, see [api.md](api.md)

## Development

### Backend Development

```bash
# Python Backend Setup
cd src/backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Required Python Packages
fastapi==0.115.8
motor==3.7.0
aiohttp==3.11.12
websockets==11.0.3
redis==4.5.4
psycopg2-binary==2.9.9
pydantic==2.10.6
uvicorn==0.21.0

# Start Backend Services
./start_services.sh

# Start Monitoring
python monitor.py

# Go Backend Setup
cd go-migration
go mod tidy
go mod vendor
go run cmd/tradingbot/main.go
```

### Frontend Development

```bash
cd src/frontend
npm run dev
```

## Environment Setup

1. Set up Python environment:
   ```bash
   python -m venv venv
   source venv/bin/activate
   pip install -e .
   ```

2. Set up Go environment:
   ```bash
   cd go-migration
   go mod download
   ```

3. Configure Solana:
   - Install Solana CLI tools
   - Set up wallet configuration
   - Configure RPC endpoints

## Monitoring

The application includes built-in monitoring capabilities:

### Service Health
- Health Check: http://localhost:8001/api/v1/health
- Jupiter Metrics: http://localhost:8001/api/v1/jupiter-metrics
- WebSocket Data: ws://localhost:8001/ws
- Real-time Trades: ws://localhost:8001/ws/trades

### Metrics Collection
- Trade execution status
- Market data updates
- Risk management alerts
- Position tracking
- Order status updates
- Circuit breaker status
- Performance metrics

### Service Dependencies
- MongoDB v7.0.16 (port 27017)
- Redis Server (port 6379)
- PostgreSQL (port 5432)
- FastAPI Backend (port 8000)
- Monitoring Service (port 8001)

## Testing

### Backend Tests

```bash
cd src/backend
pytest -v
```

### Frontend Tests

```bash
cd src/frontend
npm test
```

## Project Structure

```
tradingbot/
├── src/
│   ├── backend/
│   │   ├── main.py           # FastAPI application
│   │   ├── monitor.py        # Monitoring service
│   │   ├── execute_trades.py # Trade execution
│   │   ├── trading.py        # Trading logic
│   │   └── start_services.sh # Service startup
│   │
│   └── tradingbot/
│       ├── shared/           # Shared utilities
│       │   └── exchange/     # Exchange clients
│       └── backend/          # Backend modules
│
├── go-migration/             # Go trading implementation
│   ├── cmd/                  # Command line tools
│   │   └── tradingbot/      # Trading service
│   ├── internal/            # Internal packages
│   │   ├── market/         # Market providers
│   │   ├── trading/        # Trading logic
│   │   └── monitoring/     # Monitoring
│   └── vendor/             # Vendored dependencies
│
├── docs/                    # Documentation
│   ├── deployment.md       # Deployment guide
│   └── vendor_management.md # Dependency management
│
└── README.md
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
