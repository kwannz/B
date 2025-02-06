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
export PYTHONPATH=/home/ubuntu/repos/B
export POSTGRES_DB=tradingbot
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=trading_postgres_pass_123
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
export PUMP_API_KEY="${walletkey}"

# Start Monitoring Service
echo "=== Starting Monitoring Service ==="
cd /home/ubuntu/repos/B/go-migration/cmd/verify_monitor
go run main.go &
MONITOR_PID=$!

# Wait for monitor to start
sleep 5
if ! check_process $MONITOR_PID; then
    echo "Failed to start Monitoring Service"
    exit 1
fi

# Start Trading Executor
echo "=== Starting Trading Executor ==="
cd /home/ubuntu/repos/B/go-migration/cmd/execute_trading
go run main.go &
EXECUTOR_PID=$!

# Wait for executor to start
sleep 5
if ! check_process $EXECUTOR_PID; then
    echo "Failed to start Trading Executor"
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
