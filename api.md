# Backend API Documentation

## Market Data

### GET /v1/price/{dex}/{symbol}
Get current price from a specific DEX.
- Parameters:
  - dex: DEX name (jupiter/raydium/orca)
  - symbol: Trading pair symbol
- Response: Current price and volume data

### GET /v1/history/{dex}/{symbol}
Get historical price data from a specific DEX.
- Parameters:
  - dex: DEX name
  - symbol: Trading pair symbol
  - interval: Time interval (e.g. 1m, 5m, 1h)
  - limit: Number of data points
- Response: List of historical price/volume data points

### GET /api/v1/price/{symbol}
Get current price from Pump.fun.
- Parameters:
  - symbol: Token symbol
- Response: Current price, volume, and timestamp

### GET /api/v1/historical/{symbol}
Get historical price data from Pump.fun.
- Parameters:
  - symbol: Token symbol
  - interval: Time interval
  - limit: Number of data points
- Response: List of historical price/volume data points

### WebSocket /ws/market/{dex}
Real-time market data stream for DEX trading.
- Subscribe message format:
  ```json
  {
    "type": "subscribe",
    "symbols": ["SOL/USDC", "BONK/USDC"]
  }
  ```
- Update message format:
  ```json
  {
    "symbol": "SOL/USDC",
    "price": 100.50,
    "volume": 50000,
    "timestamp": "2024-02-04T12:34:56Z"
  }
  ```

### WebSocket /ws/pump
Real-time market data stream for Pump.fun trading.
- Subscribe message format:
  ```json
  {
    "type": "subscribe",
    "symbols": ["PEPE", "DOGE"]
  }
  ```
- Update message format:
  ```json
  {
    "symbol": "PEPE",
    "price": 0.00001234,
    "volume": 1000000,
    "timestamp": "2024-02-04T12:34:56Z"
  }
  ```

## Market Analysis

### POST /api/v1/analysis
Analyzes market data using the DeepSeek model.
- Request: `MarketData` model with symbol, price, volume, and metadata
- Response: Analysis results with market insights

## Account Management

### GET /api/v1/account/balance
Get account balance for the authenticated user.
- Response: `AccountResponse` with user_id and balance

### GET /api/v1/account/positions
Get all positions for the authenticated user.
- Response: `PositionListResponse` with list of positions

## Order Management

### POST /api/v1/orders
Create a new order.
- Request: `OrderCreate` with order details
- Response: `OrderResponse` with created order info

### GET /api/v1/orders
List all orders for the authenticated user.
- Response: `OrderListResponse` with list of orders

### GET /api/v1/orders/{order_id}
Get specific order details.
- Response: `OrderResponse` with order info

## Risk Management

### GET /api/v1/risk/metrics
Get risk metrics for the authenticated user.
- Response: `RiskMetricsResponse` with exposure, margin, and PnL info

### POST /api/v1/risk/limits
Update risk limit settings.
- Request: `LimitSettingsUpdate` with new limits
- Response: `LimitSettingsResponse` with updated settings

### GET /api/v1/risk/limits
Get current risk limit settings.
- Response: `LimitSettingsResponse` with current limits

## Strategy Management

### GET /api/v1/strategies
List all available trading strategies.
- Response: `StrategyListResponse` with list of strategies

### POST /api/v1/strategies
Create a new trading strategy.
- Request: `StrategyCreate` with strategy details
- Response: `StrategyResponse` with created strategy

## Trading Agent Management

### GET /api/v1/agents
List all available trading agents.
- Response: `AgentListResponse` with agent types

### GET /api/v1/agents/{agent_type}/status
Get status of specific agent.
- Response: `AgentResponse` with agent status

### POST /api/v1/agents/{agent_type}/start
Start a trading agent.
- Response: `AgentResponse` with updated status

### POST /api/v1/agents/{agent_type}/stop
Stop a trading agent.
- Response: `AgentResponse` with updated status

## Trade Management

### GET /api/v1/trades
List all trades.
- Response: `TradeListResponse` with list of trades

### POST /api/v1/trades
Create a new trade record.
- Request: `TradeCreate` with trade details
- Response: `TradeResponse` with created trade

## Signal Management

### GET /api/v1/signals
Get all trading signals.
- Response: `SignalListResponse` with list of signals

### POST /api/v1/signals
Create a new trading signal.
- Request: `SignalCreate` with signal details
- Response: `SignalResponse` with created signal info

## Performance Analytics

### GET /api/v1/performance
Get trading performance metrics.
- Response: `PerformanceResponse` with:
  - total_trades: Total number of trades
  - profitable_trades: Number of profitable trades
  - total_profit: Total profit/loss
  - win_rate: Ratio of profitable trades
  - average_profit: Average profit per trade
  - max_drawdown: Maximum drawdown

## WebSocket Endpoints

### /ws/trades
Real-time trade updates stream.

### /ws/signals
Real-time trading signal updates.

### /ws/performance
Real-time performance metrics stream.

### /ws/agent_status
Real-time agent status updates.

### /ws/analysis
Real-time market analysis updates.

### /ws/positions
Real-time position updates.

### /ws/orders
Real-time order updates.

### /ws/risk
Real-time risk metrics updates.

## System Health

### GET /api/v1/health
System health check endpoint.
- Response: Health status with database connectivity check

## Authentication
All endpoints except health check require Bearer token authentication.
- Token URL: /token
- Header: Authorization: Bearer {token}
