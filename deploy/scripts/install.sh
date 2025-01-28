#!/bin/bash
set -e

echo "Starting deployment..."

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "Docker required but not installed. Aborting." >&2; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "Docker Compose required but not installed. Aborting." >&2; exit 1; }

# Build and start services
cd deploy/docker
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d

echo "Installation complete! Services are starting..."
echo "Frontend: http://localhost:3001"
echo "API Gateway: http://localhost:8000"
