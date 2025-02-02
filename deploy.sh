#!/bin/bash

# Exit on error
set -e

echo "Starting deployment process..."

# Load environment variables
if [ -f ".env" ]; then
    source .env
else
    echo "Error: .env file not found"
    exit 1
fi

# Function to check if a command exists
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "Error: $1 is not installed"
        exit 1
    fi
}

# Check required commands
check_command python3
check_command pip3
check_command node
check_command npm
check_command psql

# Backend deployment
echo "Deploying backend..."
cd src/backend

# Create and activate virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate

# Install/upgrade dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Run database migrations
echo "Running database migrations..."
python init_database.py

# Restart backend service
echo "Restarting backend service..."
if [ -f "/etc/systemd/system/tradingbot-backend.service" ]; then
    sudo systemctl restart tradingbot-backend
else
    echo "Warning: Backend service not found, skipping restart"
fi

# Frontend deployment
echo "Deploying frontend..."
cd ../frontend

# Install dependencies and build
npm install
npm run build

# Deploy frontend build to web server
if [ -d "/var/www/tradingbot" ]; then
    echo "Copying frontend build to web server..."
    sudo cp -r dist/* /var/www/tradingbot/
else
    echo "Warning: Web server directory not found at /var/www/tradingbot"
fi

# Restart web server
echo "Restarting web server..."
if command -v nginx &> /dev/null; then
    sudo systemctl restart nginx
else
    echo "Warning: nginx not found, skipping restart"
fi

# Create or update systemd service for backend
echo "Updating systemd service..."
cat << EOF | sudo tee /etc/systemd/system/tradingbot-backend.service
[Unit]
Description=Trading Bot Backend
After=network.target

[Service]
User=$USER
WorkingDirectory=$(pwd)/src/backend
Environment="PATH=$(pwd)/src/backend/venv/bin"
ExecStart=$(pwd)/src/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and restart service
sudo systemctl daemon-reload
sudo systemctl enable tradingbot-backend
sudo systemctl restart tradingbot-backend

# Verify deployment
echo "Verifying deployment..."

# Check backend health
if curl -s http://localhost:8000/health > /dev/null; then
    echo "Backend is running"
else
    echo "Error: Backend is not responding"
    exit 1
fi

# Check frontend
if [ -f "/var/www/tradingbot/index.html" ]; then
    echo "Frontend files are in place"
else
    echo "Warning: Frontend files not found in web server directory"
fi

echo "Deployment completed successfully!"
