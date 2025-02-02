#!/bin/bash

# Exit on error
set -e

echo "Setting up CI/CD Pipeline Configuration"
echo "======================================"

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "GitHub CLI (gh) is not installed. Please install it first:"
    echo "https://cli.github.com/"
    exit 1
fi

# Check if logged in to GitHub
if ! gh auth status &> /dev/null; then
    echo "Please login to GitHub first:"
    gh auth login
fi

# Get repository name
REPO_NAME=$(git remote get-url origin | sed 's/.*github.com[:\/]\(.*\).git/\1/')

echo "Setting up secrets for repository: $REPO_NAME"

# Function to set a secret
set_secret() {
    local name=$1
    local prompt=$2
    local default=$3
    
    echo
    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " value
        value=${value:-$default}
    else
        read -p "$prompt: " value
    fi
    
    echo "Setting $name..."
    echo "$value" | gh secret set "$name" --repo "$REPO_NAME"
}

# Docker Hub Configuration
echo -e "\nDocker Hub Configuration"
echo "------------------------"
set_secret "DOCKER_HUB_USERNAME" "Enter your Docker Hub username"
set_secret "DOCKER_HUB_TOKEN" "Enter your Docker Hub access token (create one at https://hub.docker.com/settings/security)"

# Production Server Configuration
echo -e "\nProduction Server Configuration"
echo "--------------------------------"
set_secret "PROD_HOST" "Enter your production server hostname/IP"
set_secret "PROD_USERNAME" "Enter your production server username" "ubuntu"

# Generate and set SSH key if it doesn't exist
SSH_KEY_FILE="$HOME/.ssh/tradingbot_deploy"
if [ ! -f "$SSH_KEY_FILE" ]; then
    echo -e "\nGenerating SSH key for deployment..."
    ssh-keygen -t ed25519 -f "$SSH_KEY_FILE" -N "" -C "tradingbot-deploy"
    
    echo -e "\nAdd this public key to your production server's authorized_keys:"
    cat "${SSH_KEY_FILE}.pub"
    
    echo -e "\nPress Enter once you've added the key to your server"
    read
    
    # Set private key as secret
    echo "Setting SSH private key as secret..."
    gh secret set "SSH_PRIVATE_KEY" --repo "$REPO_NAME" < "$SSH_KEY_FILE"
fi

# Slack Configuration (Optional)
echo -e "\nSlack Configuration (Optional)"
echo "-----------------------------"
read -p "Would you like to set up Slack notifications? (y/n) [n]: " setup_slack
setup_slack=${setup_slack:-n}

if [ "$setup_slack" = "y" ]; then
    set_secret "SLACK_WEBHOOK_URL" "Enter your Slack webhook URL"
fi

# Database Configuration
echo -e "\nDatabase Configuration"
echo "---------------------"
set_secret "POSTGRES_DB" "Enter database name" "tradingbot"
set_secret "POSTGRES_USER" "Enter database user" "postgres"
set_secret "POSTGRES_PASSWORD" "Enter database password"

# JWT Configuration
echo -e "\nJWT Configuration"
echo "-----------------"
JWT_SECRET=$(openssl rand -hex 32)
echo "Generated JWT secret: $JWT_SECRET"
gh secret set "JWT_SECRET" --repo "$REPO_NAME" <<< "$JWT_SECRET"

echo -e "\nCI/CD Pipeline Configuration Complete!"
echo "======================================"
echo "The following secrets have been set:"
echo "- DOCKER_HUB_USERNAME"
echo "- DOCKER_HUB_TOKEN"
echo "- PROD_HOST"
echo "- PROD_USERNAME"
echo "- SSH_PRIVATE_KEY"
echo "- POSTGRES_DB"
echo "- POSTGRES_USER"
echo "- POSTGRES_PASSWORD"
echo "- JWT_SECRET"
if [ "$setup_slack" = "y" ]; then
    echo "- SLACK_WEBHOOK_URL"
fi

echo -e "\nNext steps:"
echo "1. Push your code to the main branch to trigger the pipeline"
echo "2. Monitor the pipeline at: https://github.com/$REPO_NAME/actions"
echo "3. Check your deployment at: http://$PROD_HOST"

# Make deploy script executable
chmod +x deploy.sh

echo -e "\nSetup complete! 🚀"
