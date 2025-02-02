#!/bin/bash

# Exit on error
set -e

echo "Setting up Trading Bot Frontend..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js and try again."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "npm is not installed. Please install npm and try again."
    exit 1
fi

# Install dependencies
echo "Installing Node.js dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo "Please update the .env file with your configuration settings."
fi

# Build the application
echo "Building the application..."
npm run build

echo "Setup complete!"
echo "To start the development server, run: npm run dev"
echo "To start the production server, run: npm run preview"
