# Services Tests

This directory contains tests for various services in the trading bot.

## Directory Structure

- `alerts/` - Tests for alert management and notification services
- `ai/` - Tests for AI analysis and prediction services
- `data/` - Tests for market data and keyword extraction services
- `jupiter/` - Tests for Jupiter DEX integration services
- `monitoring/` - Tests for system monitoring services
- `risk/` - Tests for risk management services
- `sentiment/` - Tests for sentiment analysis services
- `tasks/` - Tests for scheduled tasks and workers
- `trading/` - Tests for trading execution services
- `user/` - Tests for user management services
- `websocket/` - Tests for WebSocket services

## Running Tests

To run all service tests:
```bash
pytest tests/unit/services
```

To run tests for a specific service:
```bash
pytest tests/unit/services/[service_name]
```

## Adding New Tests

When adding new tests:
1. Create test files in the appropriate service directory
2. Follow the naming convention: `test_*.py`
3. Add necessary fixtures to the service's conftest.py
4. Update this README if adding a new service directory 