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

# 定义关键路径
declare -a CRITICAL_PATHS=(
    # 后端核心
    "src/backend/core/strategies"
    "src/backend/core/risk"
    "src/backend/core/__init__.py"
    
    # 后端服务
    "src/backend/services/dex"
    "src/backend/services/memecoins"
    
    # 前端结构
    "src/frontend/src/components"
    "src/frontend/src/features"
    "src/frontend/src/shared"
    
    # 共享代码
    "src/shared/types"
    "src/shared/utils"
    "src/shared/config"
    
    # 文档
    "docs/architecture/system_workflow.md"
    "docs/api/README.md"
    "docs/development/README.md"
    
    # 配置
    "config/env"
    "config/strategies"
)

# 定义必需文件
declare -a REQUIRED_FILES=(
    # 后端文件
    "src/backend/core/__init__.py"
    "src/backend/services/dex/__init__.py"
    "src/backend/services/memecoins/__init__.py"
    
    # 前端文件
    "src/frontend/package.json"
    "src/frontend/tsconfig.json"
    
    # 配置文件
    "config/README.md"
    ".gitignore"
    
    # 文档
    "docs/architecture/README.md"
    "docs/api/README.md"
    "docs/development/README.md"
)

# 验证目录结构
VERIFY_FAILED=0

echo -e "${YELLOW}检查关键路径...${NC}"
for path in "${CRITICAL_PATHS[@]}"; do
    if [ ! -e "$path" ]; then
        echo -e "${RED}错误：关键路径缺失 - $path${NC}"
        VERIFY_FAILED=1
    fi
done

echo -e "\n${YELLOW}检查必需文件...${NC}"
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}错误：必需文件缺失 - $file${NC}"
        VERIFY_FAILED=1
    fi
done

# 检查空目录
echo -e "\n${YELLOW}检查空目录...${NC}"
find src -type d -empty -print | while read -r dir; do
    echo -e "${YELLOW}警告：空目录 - $dir${NC}"
done

# 检查重复文件
echo -e "\n${YELLOW}检查重复文档...${NC}"
declare -a DOC_PATTERNS=(
    "workflow.md"
    "deployment.md"
    "development.md"
)

for pattern in "${DOC_PATTERNS[@]}"; do
    duplicates=$(find docs -name "$pattern" | wc -l)
    if [ "$duplicates" -gt 1 ]; then
        echo -e "${RED}错误：发现重复文档 - $pattern (${duplicates}个副本)${NC}"
        find docs -name "$pattern" -exec echo "  - {}" \;
        VERIFY_FAILED=1
    fi
done

# 检查文件权限
echo -e "\n${YELLOW}检查文件权限...${NC}"
find scripts -type f -name "*.sh" ! -perm -u=x -print | while read -r script; do
    echo -e "${YELLOW}警告：脚本文件缺少执行权限 - $script${NC}"
    chmod +x "$script"
done

if [ $VERIFY_FAILED -eq 1 ]; then
    echo -e "\n${RED}验证失败：系统结构不完整${NC}"
    echo "请运行 project_init.sh 修复问题"
    exit 1
else
    echo -e "\n${GREEN}验证通过：系统结构完整${NC}"
    
    # 显示目录结构
    if command -v tree &> /dev/null; then
        echo -e "\n${YELLOW}当前目录结构：${NC}"
        tree -L 3 -I "node_modules|__pycache__|*.pyc|.git"
    fi
fi 