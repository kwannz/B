#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 获取项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

# 日志文件
LOG_FILE="reorganize_$(date +%Y%m%d_%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo -e "${YELLOW}开始项目重组...${NC}"

# 创建备份
echo -e "${YELLOW}创建备份...${NC}"
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).tar.gz"
tar -czf "$BACKUP_FILE" \
    --exclude='*.tmp' \
    --exclude='*.bak' \
    --exclude='*.pyc' \
    --exclude='node_modules' \
    --exclude='.git' \
    src/ docs/ config/ scripts/

echo "备份文件: $BACKUP_FILE"
echo "备份SHA256校验和:"
shasum -a 256 "$BACKUP_FILE"
echo

# 创建新目录结构
echo -e "${YELLOW}创建新目录结构...${NC}"
mkdir -p \
    src/frontend/{public,src/{components,features/{dex,memecoins},shared}} \
    src/backend/{core/{strategies,risk},services/{dex,memecoins},api,infrastructure/{database,cache}} \
    src/shared/{types,utils,config} \
    docs/{architecture,api,development} \
    config/{env,strategies} \
    scripts/{deployment,migration,tools}

# 移动前端文件
echo -e "${YELLOW}整理前端文件...${NC}"
find . -maxdepth 1 -type f \( -name "*.tsx" -o -name "*.jsx" \) -exec mv {} src/frontend/src/components/ \;
find . -maxdepth 1 -type f -name "*.css" -exec mv {} src/frontend/src/styles/ \;

# 移动后端文件
echo -e "${YELLOW}整理后端文件...${NC}"
# 移动核心策略
mv src/trading_bot/core/* src/backend/core/strategies/ 2>/dev/null || true
mv src/trading_bot/risk/* src/backend/core/risk/ 2>/dev/null || true

# 移动服务
mv src/trading_bot/dex/* src/backend/services/dex/ 2>/dev/null || true
mv src/trading_bot/memecoins/* src/backend/services/memecoins/ 2>/dev/null || true

# 移动API相关文件
mv src/api_gateway/* src/backend/api/ 2>/dev/null || true

# 移动基础设施文件
mv src/database/* src/backend/infrastructure/database/ 2>/dev/null || true
mv src/cache/* src/backend/infrastructure/cache/ 2>/dev/null || true

# 移动共享代码
echo -e "${YELLOW}整理共享代码...${NC}"
mv src/shared/types/* src/shared/types/ 2>/dev/null || true
mv src/shared/utils/* src/shared/utils/ 2>/dev/null || true
mv src/shared/config/* src/shared/config/ 2>/dev/null || true

# 合并文档
echo -e "${YELLOW}整理文档...${NC}"
# 合并workflow文档
cat docs/workflow.md docs/development/workflow.md > docs/architecture/system_workflow.md 2>/dev/null || true
rm -f docs/workflow.md docs/development/workflow.md

# 移动组件文档
mv docs/components.md docs/architecture/ 2>/dev/null || true

# 清理旧目录
echo -e "${YELLOW}清理旧目录...${NC}"
declare -a OLD_DIRS=(
    "src/trading_bot"
    "src/api_gateway"
    "src/database"
    "src/cache"
    "frontend"
    "backend"
)

for dir in "${OLD_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo "删除目录: $dir"
        rm -rf "$dir"
    fi
done

# 添加必要的初始化文件
echo -e "${YELLOW}添加初始化文件...${NC}"
touch src/backend/core/__init__.py
touch src/backend/services/dex/__init__.py
touch src/backend/services/memecoins/__init__.py

# 创建基本的README文件
echo -e "${YELLOW}创建README文件...${NC}"
for dir in $(find . -type d -not -path "*/\.*" -not -path "*/node_modules*"); do
    if [ ! -f "$dir/README.md" ]; then
        echo "# ${dir##*/}" > "$dir/README.md"
        echo "此目录用于存放${dir##*/}相关文件。" >> "$dir/README.md"
    fi
done

# 验证新结构
echo -e "${YELLOW}验证新结构...${NC}"
./scripts/verify_structure.sh

if [ $? -eq 0 ]; then
    echo -e "${GREEN}项目重组完成！${NC}"
    echo "日志文件: $LOG_FILE"
    echo "备份文件: $BACKUP_FILE"
    
    # 显示新的目录结构
    if command -v tree &> /dev/null; then
        echo -e "\n${YELLOW}新的目录结构：${NC}"
        tree -L 4 -I "node_modules|__pycache__|*.pyc|.git"
    fi
else
    echo -e "${RED}项目重组失败，请检查日志文件：$LOG_FILE${NC}"
    echo -e "${YELLOW}可以使用以下命令从备份恢复：${NC}"
    echo "tar -xzf $BACKUP_FILE"
    exit 1
fi 