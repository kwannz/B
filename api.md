# Backend API Documentation

## Market Data

### GET /v1/price/{dex}/{symbol}
Get current price from a specific DEX.
- Parameters:
  - dex: DEX name (gmgn)
  - symbol: Trading pair symbol
- Response: Current price and volume data

## Agent Management

### POST /api/v1/agents
Creates a new trading agent.
- Request body:
  ```json
  {
      "type": "string",  // Required: Type of agent to create
      "status": "string" // Optional: Initial agent status (default: STOPPED)
  }
  ```
- Response: AgentResponse object with type, status, and last_updated timestamp
- Error codes:
  - 400: Agent type is required
  - 409: Agent already exists
  - 500: Failed to create agent

### DELETE /api/v1/agents/{agent_type}
Deletes an existing agent. If running, stops before deletion.
- Parameters:
  - agent_type: Type of agent to delete
- Response: AgentResponse object of deleted agent
- Error codes:
  - 400: Agent type is required
  - 404: Agent not found
  - 500: Failed to delete agent

### PATCH /api/v1/agents/{agent_type}/status
Updates the status of an existing agent.
- Parameters:
  - agent_type: Type of agent to update
- Request body:
  ```json
  {
      "status": "string" // Required: New agent status (RUNNING/STOPPED)
  }
  ```
- Response: AgentResponse object with updated status
- Error codes:
  - 400: Agent type is required
  - 404: Agent not found
  - 500: Failed to update status

### GET /api/v1/agents/{agent_type}/status
Gets current agent status. Creates new stopped agent if not exists.
- Parameters:
  - agent_type: Type of agent to query
- Response: AgentResponse object with current status
- Error codes:
  - 400: Agent type is required
  - 500: Failed to get status

### POST /api/v1/agents/{agent_type}/start
Starts an agent. Creates new one if not exists.
- Parameters:
  - agent_type: Type of agent to start
- Response: AgentResponse object with RUNNING status
- Error codes:
  - 400: Agent type is required
  - 500: Failed to start agent

### POST /api/v1/agents/{agent_type}/stop
Stops a running agent.
- Parameters:
  - agent_type: Type of agent to stop
- Response: AgentResponse object with STOPPED status
- Error codes:
  - 400: Agent type is required
  - 404: Agent not found
  - 500: Failed to stop agent

## Models

### AgentResponse
```json
{
    "type": "string",     // Type of agent
    "status": "string",   // RUNNING or STOPPED
    "last_updated": "string" // ISO 8601 timestamp
}
```

## System Health

### GET /api/v1/health
System health check endpoint.
- Response: Health status with database connectivity check

## Authentication
All endpoints except health check require Bearer token authentication.
- Token URL: /token
- Header: Authorization: Bearer {token}
