#!/bin/bash

# Exit on error
set -e

echo "Setting up Trading Bot..."

# Function to check if a command exists
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "$1 is not installed. Please install $1 and try again."
        exit 1
    fi
}

# Check required tools
echo "Checking required tools..."
check_command python3
check_command pip3
check_command node
check_command npm
check_command psql

# Setup backend
echo -e "\nSetting up backend..."
cd src/backend
./setup.sh
cd ../..

# Setup frontend
echo -e "\nSetting up frontend..."
cd src/frontend
./setup.sh
cd ../..

echo -e "\nSetup complete!"
echo "To start the application:"
echo "1. Start the backend server:"
echo "   cd src/backend"
echo "   source venv/bin/activate"
echo "   uvicorn main:app --reload"
echo ""
echo "2. In a new terminal, start the frontend development server:"
echo "   cd src/frontend"
echo "   npm run dev"
echo ""
echo "The application will be available at:"
echo "- Frontend: http://localhost:5173"
echo "- Backend API: http://localhost:8000"
echo "- API Documentation: http://localhost:8000/docs"
