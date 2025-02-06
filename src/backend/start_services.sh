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

# Set environment variables
export PYTHONPATH=/home/ubuntu/repos/B/src
export POSTGRES_DB=tradingbot
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=trading_postgres_pass_123
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
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
sudo systemctl start mongod || sudo service mongod start
sudo systemctl start redis-server || sudo service redis-server start
sudo systemctl start postgresql || sudo service postgresql start
sleep 2

# Start Backend API with monitoring
echo "=== Starting Backend API with Monitoring ==="
cd /home/ubuntu/repos/B/src/backend
python3 -m uvicorn monitor:app --host 0.0.0.0 --port 8001 &
MONITOR_PID=$!

# Wait for monitor to start
sleep 5
if ! check_process $MONITOR_PID; then
    echo "Failed to start Monitoring Service"
    exit 1
fi

# Start Trading Service
echo "=== Starting Trading Service ==="
cd /home/ubuntu/repos/B/src/backend
python3 -m uvicorn trading:app --host 0.0.0.0 --port 8002 &
EXECUTOR_PID=$!

# Wait for trading to start
sleep 5
if ! ps -p $EXECUTOR_PID > /dev/null; then
    echo "Failed to start Trading Service"
    kill $MONITOR_PID
    exit 1
fi

# Start Backend API
echo "=== Starting Backend API ==="
cd /home/ubuntu/repos/B/src/backend
uvicorn main:app --host 0.0.0.0 --port 8000 &
API_PID=$!

# Wait for API to start
sleep 5
if ! check_process $API_PID; then
    echo "Failed to start Backend API"
    kill $MONITOR_PID $EXECUTOR_PID
    exit 1
fi

echo "=== All Services Started Successfully ==="
echo "Monitor PID: $MONITOR_PID"
echo "Executor PID: $EXECUTOR_PID"
echo "API PID: $API_PID (port 8000)"

# Keep running until interrupted
trap "kill $MONITOR_PID $EXECUTOR_PID $API_PID 2>/dev/null || true" EXIT
wait
