#!/bin/bash
set -e

# Function to wait for PostgreSQL
wait_for_postgres() {
    MAX_RETRIES=30
    RETRY_COUNT=0
    
    echo "Waiting for PostgreSQL..."
    until PGPASSWORD=tradingbot psql -h postgres -U tradingbot -d postgres -c '\q' 2>/dev/null || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
        echo "PostgreSQL is unavailable - sleeping (attempt $((RETRY_COUNT+1))/$MAX_RETRIES)"
        RETRY_COUNT=$((RETRY_COUNT+1))
        sleep 2
    done
    
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        echo "Failed to connect to PostgreSQL after $MAX_RETRIES attempts"
        return 1
    fi
    
    echo "PostgreSQL is up"
    return 0
}

# Function to initialize database
init_database() {
    MAX_DB_RETRIES=5
    DB_RETRY_COUNT=0
    
    echo "Initializing database..."
    until python -m src.api_gateway.init_db || [ $DB_RETRY_COUNT -eq $MAX_DB_RETRIES ]; do
        echo "Database initialization failed. Retrying in 5 seconds... (attempt $((DB_RETRY_COUNT+1))/$MAX_DB_RETRIES)"
        DB_RETRY_COUNT=$((DB_RETRY_COUNT+1))
        sleep 5
    done
    
    if [ $DB_RETRY_COUNT -eq $MAX_DB_RETRIES ]; then
        echo "Failed to initialize database after $MAX_DB_RETRIES attempts"
        return 1
    fi
    
    echo "Database initialization complete"
    return 0
}

# Main execution
if ! wait_for_postgres; then
    exit 1
fi

if ! init_database; then
    exit 1
fi

echo "Starting application..."

# Function to verify service health
verify_service_health() {
    local service_name=$1
    local health_endpoint=$2
    local max_retries=30
    local retry_count=0

    echo "Verifying $service_name health..."
    until curl -s -f "$health_endpoint" > /dev/null || [ $retry_count -eq $max_retries ]; do
        echo "$service_name health check failed. Retrying in 2 seconds... (attempt $((retry_count+1))/$max_retries)"
        retry_count=$((retry_count+1))
        sleep 2
    done

    if [ $retry_count -eq $max_retries ]; then
        echo "Failed to verify $service_name health after $max_retries attempts"
        return 1
    fi

    echo "$service_name is healthy"
    return 0
}

# Verify service health based on SERVICE_NAME environment variable
case "$SERVICE_NAME" in
    "api_gateway")
        if ! verify_service_health "API Gateway" "http://localhost:8000/health"; then
            exit 1
        fi
        ;;
    "trading_agent")
        if ! verify_service_health "Trading Agent" "http://localhost:8001/health"; then
            exit 1
        fi
        ;;
    *)
        echo "Unknown service: $SERVICE_NAME"
        exit 1
        ;;
esac

# Execute the main command
exec "$@"
