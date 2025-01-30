#!/bin/bash
set -e

echo "Starting Trading Bot deployment..."

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed. Aborting." >&2; exit 1; }
# Verify docker compose functionality
docker compose version >/dev/null 2>&1 || { echo "Docker Compose is required but not installed. Aborting." >&2; exit 1; }

# Copy environment files
cp deploy/config/.env deploy/docker/.env

# Build and start services
cd deploy/docker
docker compose build --no-cache
docker compose up -d

echo "Deployment complete! Services are starting..."
echo "Frontend: http://localhost:3001"
echo "API Gateway: http://localhost:8000"
echo "Monitoring: http://localhost:3000"
