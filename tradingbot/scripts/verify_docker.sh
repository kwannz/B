#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Verifying Docker setup...${NC}"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker is not installed${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Docker Compose is not installed${NC}"
    exit 1
fi

# Check if required files exist
required_files=(
    "Dockerfile"
    "docker-compose.yml"
    "docker/prometheus/prometheus.yml"
    "docker/prometheus/alert.rules"
    "docker/prometheus/alertmanager.yml"
    "docker/grafana/provisioning/datasources/prometheus.yml"
    "docker/grafana/provisioning/dashboards/tradingbot.yml"
    "docker/mongodb/init.js"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}Missing required file: $file${NC}"
        exit 1
    fi
done

echo -e "${GREEN}All required files present${NC}"

# Check if .env file exists, create from example if not
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${YELLOW}Created .env file from .env.example${NC}"
    else
        echo -e "${RED}No .env or .env.example file found${NC}"
        exit 1
    fi
fi

# Pull required Docker images
echo -e "${YELLOW}Pulling Docker images...${NC}"
docker-compose pull

# Build the API service
echo -e "${YELLOW}Building API service...${NC}"
docker-compose build api

# Start services in detached mode
echo -e "${YELLOW}Starting services...${NC}"
docker-compose up -d

# Wait for services to be ready
echo -e "${YELLOW}Waiting for services to be ready...${NC}"
sleep 10

# Check if services are running
services=(
    "api:8000"
    "mongodb:27017"
    "redis:6379"
    "prometheus:9090"
    "pushgateway:9091"
    "grafana:3000"
    "alertmanager:9093"
)

for service in "${services[@]}"; do
    IFS=':' read -r -a array <<< "$service"
    name="${array[0]}"
    port="${array[1]}"
    
    if ! docker-compose ps | grep -q "$name.*Up"; then
        echo -e "${RED}Service $name is not running${NC}"
        docker-compose logs "$name"
        exit 1
    fi
    
    echo -e "${GREEN}Service $name is running${NC}"
done

# Test API health endpoint
echo -e "${YELLOW}Testing API health endpoint...${NC}"
curl -f http://localhost:8000/health || {
    echo -e "${RED}API health check failed${NC}"
    exit 1
}

# Test Prometheus endpoint
echo -e "${YELLOW}Testing Prometheus endpoint...${NC}"
curl -f http://localhost:9090/-/healthy || {
    echo -e "${RED}Prometheus health check failed${NC}"
    exit 1
}

# Test Grafana endpoint
echo -e "${YELLOW}Testing Grafana endpoint...${NC}"
curl -f http://localhost:3000/api/health || {
    echo -e "${RED}Grafana health check failed${NC}"
    exit 1
}

echo -e "${GREEN}All services are running and healthy!${NC}"
echo -e "\nAccess points:"
echo -e "API: http://localhost:8000"
echo -e "Grafana: http://localhost:3000 (admin/admin)"
echo -e "Prometheus: http://localhost:9090"
echo -e "AlertManager: http://localhost:9093"

# Print logs if requested
if [ "$1" == "--logs" ]; then
    echo -e "\n${YELLOW}Service logs:${NC}"
    docker-compose logs
fi
