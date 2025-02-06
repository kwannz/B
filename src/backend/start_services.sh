#!/bin/bash
set -e

# Function to check if a process is running
check_process() {
    if ps -p $1 > /dev/null; then
        return 0
    else
        return 1
    fi
}

# Function to check service health
check_service_health() {
    local port=$1
    local max_retries=30
    local retry=0
    while [ $retry -lt $max_retries ]; do
        response=$(curl -s "http://localhost:$port/api/v1/health")
        if [ $? -eq 0 ] && echo "$response" | grep -q "healthy"; then
            echo "Service on port $port is healthy"
            return 0
        fi
        echo "Waiting for service on port $port (attempt $((retry + 1))/$max_retries)..."
        sleep 2
        retry=$((retry + 1))
    done
    echo "Service health check failed on port $port after $max_retries attempts"
    return 1
}

# Set environment variables
export PYTHONPATH=/home/ubuntu/repos/B/src
export POSTGRES_DB=tradingbot
export MONGODB_URL="mongodb://localhost:27017/tradingbot"
export REDIS_URL="redis://localhost:6379"
export GMGN_API_KEY="${walletkey}"
export SOLANA_WALLET_KEY="${walletkey}"
export BACKUP_WALLET_KEY="${walletkey_2}"

# Install package in development mode
cd /home/ubuntu/repos/B/src/tradingbot
pip install -e . || {
    echo "Failed to install tradingbot package"
    exit 1
}

# Initialize database if needed
cd /home/ubuntu/repos/B/src/backend
python init_db.py || {
    echo "Failed to initialize database"
    exit 1
}

# Start MongoDB and Redis if not running
echo "=== Starting Required Services ==="
# Kill any existing processes
pkill -f "uvicorn.*:app" || true
pkill -f prometheus_client || true
sleep 2

# Start and verify MongoDB
echo "Starting MongoDB..."
sudo systemctl start mongod || sudo service mongod start
if ! mongosh --eval "db.adminCommand('ping')" > /dev/null; then
    echo "Failed to start MongoDB"
    exit 1
fi

# Start and verify Redis
echo "Starting Redis..."
sudo systemctl start redis-server || sudo service redis-server start
if ! redis-cli ping > /dev/null; then
    echo "Failed to start Redis"
    exit 1
fi

# Wait for services to fully initialize
sleep 2

# Function to cleanup processes
cleanup() {
    echo "Cleaning up processes..."
    kill $MONITOR_PID $TRADING_PID $API_PID 2>/dev/null || true
    wait $MONITOR_PID $TRADING_PID $API_PID 2>/dev/null || true
    exit 0
}

# Set trap for cleanup
trap cleanup SIGINT SIGTERM EXIT

# Start Monitor Service
echo "=== Starting Monitor Service ==="
cd /home/ubuntu/repos/B/src/backend
PYTHONPATH=/home/ubuntu/repos/B/src python3 -m uvicorn monitor:app --host 0.0.0.0 --port 8001 &
MONITOR_PID=$!

# Wait for monitor to start
if ! check_service_health 8001; then
    echo "Failed to start Monitor Service"
    cleanup
    exit 1
fi
echo "Monitor service started successfully (PID: $MONITOR_PID)"

# Start Trading Service
echo "=== Starting Trading Service ==="
PYTHONPATH=/home/ubuntu/repos/B/src python3 -m uvicorn trading:app --host 0.0.0.0 --port 8002 &
TRADING_PID=$!

# Wait for trading service to start
if ! check_service_health 8002; then
    echo "Failed to start Trading Service"
    cleanup
    exit 1
fi
echo "Trading service started successfully (PID: $TRADING_PID)"

# Start Backend API
echo "=== Starting Backend API ==="
PYTHONPATH=/home/ubuntu/repos/B/src python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 &
API_PID=$!

# Wait for API to start
if ! check_service_health 8000; then
    echo "Failed to start Backend API"
    cleanup
    exit 1
fi
echo "API service started successfully (PID: $API_PID)"

echo "=== All Services Started Successfully ==="
echo "Monitor Service: PID $MONITOR_PID (port 8001)"
echo "Trading Service: PID $TRADING_PID (port 8002)"
echo "Backend API: PID $API_PID (port 8000)"

# Wait for all processes
wait
