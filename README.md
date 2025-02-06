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

- Python 3.12
- Go 1.23
- Node.js 16 or higher
- npm (Node Package Manager)
- PostgreSQL 12 or higher
- Docker and Docker Compose
- Git
- GitHub CLI (for CI/CD setup)
- Solana CLI tools
- Base58 encoding tools

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
# Python Backend
cd src/backend
python -m venv venv
source venv/bin/activate
pip install -e .
uvicorn main:app --reload --port 8000

# Go Backend
cd go-migration
go mod download
go build -o bin/trading ./cmd/execute_trading
./bin/trading
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

- Real-time trade execution monitoring
- Performance metrics tracking
- Risk management alerts
- Position tracking
- Order status updates

Access monitoring endpoints:
- `/api/v1/performance` - Trading performance metrics
- `/api/v1/risk/metrics` - Risk monitoring
- `/ws/trades` - Real-time trade updates

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
│   │   ├── database.py       # Database models
│   │   ├── websocket.py      # WebSocket handlers
│   │   └── tests/            # Backend tests
│   │
│   └── frontend/
│       ├── src/              # React components
│       ├── api/              # API clients
│       └── tests/            # Frontend tests
│
├── go-migration/             # Go trading implementation
│   ├── cmd/                  # Command line tools
│   ├── internal/            # Internal packages
│   └── tests/               # Go tests
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
