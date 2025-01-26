#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting test environment...${NC}"

# Ensure we're in the project root
cd "$(dirname "$0")/.."

# Clean up any previous test containers
echo "Cleaning up previous test containers..."
docker-compose -f docker-compose.test.yml down -v

# Build and start the test containers
echo "Building test containers..."
docker-compose -f docker-compose.test.yml build

echo "Starting test containers..."
docker-compose -f docker-compose.test.yml up -d test-db test-redis

# Wait for databases to be ready
echo "Waiting for databases to be ready..."
sleep 5

# Run the tests
echo -e "${GREEN}Running tests...${NC}"
docker-compose -f docker-compose.test.yml run --rm test pytest \
    --cov=src \
    --cov-report=term-missing \
    --cov-report=html:coverage/html \
    --cov-report=xml:coverage/coverage.xml \
    tests/

# Capture the exit code
TEST_EXIT_CODE=$?

# Clean up
echo "Cleaning up test containers..."
docker-compose -f docker-compose.test.yml down -v

# Check if tests passed
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}Tests passed successfully!${NC}"
    echo -e "${GREEN}Coverage report has been generated in coverage/html/index.html${NC}"
else
    echo -e "${RED}Tests failed with exit code $TEST_EXIT_CODE${NC}"
fi

exit $TEST_EXIT_CODE
