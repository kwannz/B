#!/bin/bash

# Color definitions
RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
NC="\033[0m"

# Get project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo -e "${YELLOW}Starting project structure verification...${NC}"

# Critical paths definition
declare -a CRITICAL_PATHS=(
    "src/tradingbot/api/core"
    "src/tradingbot/api/models"
    "src/tradingbot/api/routers"
    "src/tradingbot/api/services"
    "config"
    "scripts"
    "scripts/verification"
    "docs/architecture"
    "docs/api"
    "docs/development"
    "config/env"
    "config/strategies"
    "scripts/deployment"
    "scripts/migration"
    "scripts/tools"
)

# Required files definition
declare -a REQUIRED_FILES=(
    "src/tradingbot/api/core/__init__.py"
    "src/tradingbot/api/models/__init__.py"
    "src/tradingbot/api/routers/__init__.py"
    "src/tradingbot/api/services/__init__.py"
    "config/.env.example"
    ".gitignore"
    "requirements.txt"
    "scripts/verification/verify_structure.sh"
)

# Check directories
check_directories() {
    local errors=0
    echo -e "${YELLOW}Checking critical directories...${NC}"
    
    for path in "${CRITICAL_PATHS[@]}"; do
        if [ ! -d "$path" ]; then
            echo -e "${RED}Missing directory: $path${NC}"
            errors=$((errors + 1))
        else
            echo -e "${GREEN}✓ Found directory: $path${NC}"
        fi
    done
    
    return $errors
}

# Check files
check_files() {
    local errors=0
    echo -e "\n${YELLOW}Checking required files...${NC}"
    
    for file in "${REQUIRED_FILES[@]}"; do
        if [ ! -f "$file" ]; then
            echo -e "${RED}Missing file: $file${NC}"
            errors=$((errors + 1))
        else
            echo -e "${GREEN}✓ Found file: $file${NC}"
        fi
    done
    
    return $errors
}

# Check empty directories
check_empty_directories() {
    local errors=0
    echo -e "\n${YELLOW}Checking for empty directories...${NC}"
    
    for path in "${CRITICAL_PATHS[@]}"; do
        if [ -d "$path" ] && [ -z "$(ls -A $path)" ]; then
            echo -e "${RED}Empty directory: $path${NC}"
            errors=$((errors + 1))
        fi
    done
    
    return $errors
}

# Check duplicate docs
check_duplicate_docs() {
    local errors=0
    echo -e "\n${YELLOW}Checking for duplicate documentation...${NC}"
    
    local -a doc_patterns=("workflow.md" "deployment.md" "development.md")
    
    for pattern in "${doc_patterns[@]}"; do
        local count=$(find docs -name "$pattern" | wc -l)
        if [ $count -gt 1 ]; then
            echo -e "${RED}Found duplicate documentation: $pattern ($count copies)${NC}"
            find docs -name "$pattern"
            errors=$((errors + 1))
        fi
    done
    
    return $errors
}

# Main function
main() {
    local total_errors=0
    
    check_directories
    total_errors=$((total_errors + $?))
    
    check_files
    total_errors=$((total_errors + $?))
    
    check_empty_directories
    total_errors=$((total_errors + $?))
    
    check_duplicate_docs
    total_errors=$((total_errors + $?))
    
    echo -e "\n${YELLOW}Verification complete.${NC}"
    if [ $total_errors -eq 0 ]; then
        echo -e "${GREEN}All checks passed successfully${NC}"
        exit 0
    else
        echo -e "${RED}Found $total_errors issue(s) that need attention.${NC}"
        exit 1
    fi
}

main
