#!/bin/bash

# Configuration
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Check service status
docker-compose -f "$DEPLOY_DIR/docker/docker-compose.yml" ps

# Show logs
docker-compose -f "$DEPLOY_DIR/docker/docker-compose.yml" logs -f
