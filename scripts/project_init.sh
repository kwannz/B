#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 获取项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# 日志文件
LOG_FILE="project_init_$(date +%Y%m%d_%H%M%S).log"

# 检查参数
MODE=$1
if [[ "$MODE" != "--dry-run" && "$MODE" != "--confirm" ]]; then
    echo -e "${RED}请使用 --dry-run 或 --confirm 参数${NC}"
    exit 1
fi

# 记录日志
exec > >(tee -a "$LOG_FILE") 2>&1

echo -e "${YELLOW}开始项目初始化...${NC}"
echo "运行模式: $MODE"
echo "时间: $(date)"
echo "工作目录: $PROJECT_ROOT"
echo

# 定义目录结构
declare -a DIRECTORIES=(
    # Frontend
    "src/frontend/public"
    "src/frontend/src/components"
    "src/frontend/src/features/dex"
    "src/frontend/src/features/memecoins"
    "src/frontend/src/shared"
    
    # Backend
    "src/backend/core/strategies"
    "src/backend/core/risk"
    "src/backend/services/dex"
    "src/backend/services/memecoins"
    "src/backend/api"
    "src/backend/infrastructure/database"
    "src/backend/infrastructure/cache"
    
    # Shared
    "src/shared/types"
    "src/shared/utils"
    "src/shared/config"
    
    # Docs
    "docs/architecture"
    "docs/api"
    "docs/development"
    
    # Config
    "config/env"
    "config/strategies"
    
    # Scripts
    "scripts/deployment"
    "scripts/migration"
    "scripts/tools"
)

# 创建备份
if [[ "$MODE" == "--confirm" ]]; then
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
fi

# 创建目录结构
echo -e "${YELLOW}创建目录结构...${NC}"
for dir in "${DIRECTORIES[@]}"; do
    if [[ "$MODE" == "--dry-run" ]]; then
        echo "将创建目录: $dir"
    else
        mkdir -p "$dir"
        echo "已创建目录: $dir"
    fi
done

# 迁移文件
echo -e "${YELLOW}迁移文件...${NC}"
declare -a MIGRATIONS=(
    # Backend migrations
    "src/trading_bot/dex:src/backend/services/dex"
    "src/trading_bot/memecoins:src/backend/services/memecoins"
    "src/shared/strategies:src/backend/core/strategies"
    
    # Documentation migrations
    "docs/workflow.md:docs/architecture/system_workflow.md"
    "docs/development/workflow.md:docs/architecture/system_workflow.md"
)

for migration in "${MIGRATIONS[@]}"; do
    IFS=':' read -r source dest <<< "$migration"
    if [ -e "$source" ]; then
        if [[ "$MODE" == "--dry-run" ]]; then
            echo "将迁移: $source -> $dest"
        else
            if [[ "$source" == *.md && -f "$dest" ]]; then
                # 合并markdown文件
                echo "合并文件: $source -> $dest"
                cat "$source" >> "$dest"
            else
                # 移动其他文件
                echo "移动: $source -> $dest"
                mv "$source" "$dest"
            fi
        fi
    fi
done

# 验证系统完整性
echo -e "${YELLOW}验证系统完整性...${NC}"
declare -a REQUIRED_DIRS=(
    "src/backend/core"
    "src/backend/services"
    "src/backend/services/dex"
    "src/backend/services/memecoins"
    "src/frontend/src"
    "docs/architecture"
    "config"
)

declare -a REQUIRED_FILES=(
    "src/backend/core/__init__.py"
    "docs/architecture/README.md"
    "config/README.md"
)

VERIFY_FAILED=0
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        echo -e "${RED}错误：关键目录缺失 - $dir${NC}"
        VERIFY_FAILED=1
    fi
done

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}错误：关键文件缺失 - $file${NC}"
        VERIFY_FAILED=1
    fi
done

if [ $VERIFY_FAILED -eq 1 ]; then
    echo -e "${RED}验证失败：系统结构不完整${NC}"
    if [[ "$MODE" == "--confirm" ]]; then
        echo -e "${YELLOW}建议从备份恢复:${NC}"
        echo "tar -xzf $BACKUP_FILE"
    fi
    exit 1
else
    echo -e "${GREEN}验证通过：系统结构完整${NC}"
fi

# 清理临时文件
if [[ "$MODE" == "--confirm" ]]; then
    echo -e "${YELLOW}清理临时文件...${NC}"
    find . -name "*.bak" -delete
    find . -name "*.tmp" -delete
    find . -name "*.pyc" -delete
fi

echo
if [[ "$MODE" == "--dry-run" ]]; then
    echo -e "${GREEN}初始化检查完成。使用 --confirm 参数执行实际初始化。${NC}"
else
    echo -e "${GREEN}初始化完成！${NC}"
    echo "初始化日志已保存到: $LOG_FILE"
    echo "备份文件: $BACKUP_FILE"
fi
