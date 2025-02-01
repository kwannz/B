#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Running code formatters and linters...${NC}"

# Run black formatter
echo "Running black..."
black src tests || {
    echo -e "${RED}Black formatting failed${NC}"
    exit 1
}

# Run isort
echo "Running isort..."
isort src tests || {
    echo -e "${RED}Import sorting failed${NC}"
    exit 1
}

# Run flake8
echo "Running flake8..."
flake8 src tests || {
    echo -e "${RED}Flake8 check failed${NC}"
    exit 1
}

# Run mypy type checking
echo "Running mypy..."
mypy src tests || {
    echo -e "${RED}Type checking failed${NC}"
    exit 1
}

echo -e "${YELLOW}Running configuration tests...${NC}"

# Run configuration tests
./scripts/test_config.py || {
    echo -e "${RED}Configuration tests failed${NC}"
    exit 1
}

echo -e "${YELLOW}Running unit tests...${NC}"

# Create coverage directory if it doesn't exist
mkdir -p coverage

# Run pytest with coverage
pytest \
    --cov=src \
    --cov-report=term-missing \
    --cov-report=html:coverage/html \
    --cov-report=xml:coverage/coverage.xml \
    --junitxml=coverage/junit.xml \
    -v \
    tests/unit/ || {
    echo -e "${RED}Unit tests failed${NC}"
    exit 1
}

echo -e "${YELLOW}Running integration tests...${NC}"

# Start Docker services if needed
if [ "$CI" != "true" ]; then
    ./scripts/manage_docker.sh start || {
        echo -e "${RED}Failed to start Docker services${NC}"
        exit 1
    }
    
    # Wait for services to be ready
    sleep 10
fi

# Run integration tests
pytest \
    --cov=src \
    --cov-report=term-missing \
    --cov-report=html:coverage/html \
    --cov-report=xml:coverage/coverage.xml \
    --junitxml=coverage/junit.xml \
    -v \
    tests/integration/ || {
    echo -e "${RED}Integration tests failed${NC}"
    
    # Stop Docker services if we started them
    if [ "$CI" != "true" ]; then
        ./scripts/manage_docker.sh stop
    fi
    
    exit 1
}

# Stop Docker services if we started them
if [ "$CI" != "true" ]; then
    ./scripts/manage_docker.sh stop
fi

# Check coverage threshold
coverage report --fail-under=95 || {
    echo -e "${RED}Coverage is below 95%${NC}"
    echo -e "${YELLOW}Generating detailed coverage report...${NC}"
    coverage report --show-missing
    exit 1
}

# Generate detailed coverage reports
echo -e "${YELLOW}Generating detailed coverage reports...${NC}"
coverage html --directory=coverage/html
coverage xml -o coverage/coverage.xml

echo -e "${GREEN}All tests passed successfully!${NC}"

# Generate coverage badge
coverage-badge -o coverage/coverage.svg

# Print test summary
echo -e "\n${YELLOW}Test Summary:${NC}"
echo "Coverage report available at: coverage/html/index.html"
echo "JUnit report available at: coverage/junit.xml"
echo "Coverage badge available at: coverage/coverage.svg"

# Create test summary file
cat > test_summary.txt << EOF
Test Summary ($(date))
---------------------
Unit Tests: ✅
Integration Tests: ✅
Configuration Tests: ✅
Code Coverage: $(coverage report | grep TOTAL | awk '{print $NF}')
Linting: ✅
Type Checking: ✅

Reports:
- Coverage HTML: coverage/html/index.html
- Coverage XML: coverage/coverage.xml
- JUnit XML: coverage/junit.xml
- Coverage Badge: coverage/coverage.svg
EOF

echo -e "\n${GREEN}Test summary written to test_summary.txt${NC}"
