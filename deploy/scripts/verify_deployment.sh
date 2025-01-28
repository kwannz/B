#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Helper functions
log_success() { echo -e "${GREEN}✓ $1${NC}"; }
log_error() { echo -e "${RED}✗ $1${NC}"; exit 1; }

# Check service health
check_service() {
    local service=$1
    local url=$2
    local max_retries=30
    local count=0
    
    echo "Checking $service..."
    while [ $count -lt $max_retries ]; do
        if curl -s -f "$url" > /dev/null 2>&1; then
            log_success "$service is running"
            return 0
        fi
        ((count++))
        sleep 2
    done
    log_error "$service failed to start"
}

# Verify database connection
verify_database() {
    echo "Verifying database connection..."
    if ! docker-compose exec -T postgres pg_isready -U postgres; then
        log_error "Database connection failed"
    fi
    log_success "Database connection verified"
}

# Verify Redis connection
verify_redis() {
    echo "Verifying Redis connection..."
    if ! docker-compose exec -T redis redis-cli ping | grep -q "PONG"; then
        log_error "Redis connection failed"
    fi
    log_success "Redis connection verified"
}

# Main verification flow
echo "Starting deployment verification..."

cd deploy/docker

# Check core services
check_service "Frontend" "http://localhost:3001"
check_service "API Gateway" "http://localhost:8000/health"
check_service "Grafana" "http://localhost:3000"

# Verify databases
verify_database
verify_redis

log_success "All services verified successfully!"
