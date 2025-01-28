#!/bin/bash
set -e

# Setup Python environment
echo "Setting up Python environment..."
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install -e .

# Setup Node.js environment
echo "Setting up Node.js environment..."
cd src/frontend
yarn install

# Setup local configuration
echo "Setting up configuration..."
cp config/development/.env.example .env

echo "Development setup complete!"
