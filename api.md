# Backend API Documentation

## Market Data

### GET /v1/price/{dex}/{symbol}
Get current price from a specific DEX.
- Parameters:
  - dex: DEX name (jupiter/raydium/orca)
  - symbol: Trading pair symbol
- Response: Current price and volume data

[... rest of api.md content ...]

## System Health

### GET /api/v1/health
System health check endpoint.
- Response: Health status with database connectivity check

## Authentication
All endpoints except health check require Bearer token authentication.
- Token URL: /token
- Header: Authorization: Bearer {token}
