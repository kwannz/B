#!/bin/bash

# Initialize Python environment
python -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install --upgrade pip
pip install -r src/api_gateway/requirements.txt

# Install frontend dependencies
cd src/frontend
npm install

# Start services in background
cd ../api_gateway
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &

# Start frontend
cd ../frontend
npm start
