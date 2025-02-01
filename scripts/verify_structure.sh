#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 获取项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo -e "${YELLOW}开始验证项目结构...${NC}"

# 关键路径定义
declare -a CRITICAL_PATHS=(
    # Backend paths
    "src/backend/services/dex/interfaces"
    "src/backend/services/memecoins"
    "src/backend/core/strategies"
    "src/backend/core/risk"
    "src/backend/api"
    "src/backend/infrastructure/database"
    "src/backend/infrastructure/cache"
    
    # Frontend paths
    "src/frontend/src/components"
    "src/frontend/src/features/dex"
    "src/frontend/src/features/memecoins"
    "src/frontend/src/shared/visualization"
    
    # Shared paths
    "src/shared/types"
    "src/shared/utils"
    "src/shared/config"
    
    # Documentation
    "docs/architecture"
    "docs/api"
    "docs/development"
    
    # Configuration
    "config/env"
    "config/strategies"
    
    # Scripts
    "scripts/deployment"
    "scripts/migration"
    "scripts/tools"
)

# 必需文件定义
declare -a REQUIRED_FILES=(
    # Backend files
    "src/backend/core/__init__.py"
    "src/backend/services/dex/__init__.py"
    "src/backend/services/memecoins/__init__.py"
    
    # Frontend files
    "src/frontend/package.json"
    "src/frontend/tsconfig.json"
    
    # Configuration files
    "config/README.md"
    ".gitignore"
    
    # Documentation files
    "docs/architecture/README.md"
    "docs/api/README.md"
    "docs/development/README.md"
)

# 检查目录
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

# 检查文件
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

# 检查空目录
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

# 检查重复文档
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

# 主函数
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
        echo -e "${GREEN}All checks passed successfully!${NC}"
        exit 0
    else
        echo -e "${RED}Found $total_errors issue(s) that need attention.${NC}"
        exit 1
    fi
}

# 执行主函数
main

# 检查文件权限
echo -e "\n${YELLOW}检查文件权限...${NC}"
find scripts -type f -name "*.sh" ! -perm -u=x -print | while read -r script; do
    echo -e "${YELLOW}警告：脚本文件缺少执行权限 - $script${NC}"
    chmod +x "$script"
done

# 显示目录结构
if command -v tree &> /dev/null; then
    echo -e "\n${YELLOW}当前目录结构：${NC}"
    tree -L 3 -I "node_modules|__pycache__|*.pyc|.git"
fi 