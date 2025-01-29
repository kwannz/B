#!/bin/bash
set -e

# Wait for dependencies
echo "Waiting for dependencies..."
sleep 5

# Start the application
echo "Starting application..."
exec uvicorn src.backend.api_gateway.app.main:app --host 0.0.0.0 --port 8000 --reload
