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
LOG_FILE="cleanup_$(date +%Y%m%d_%H%M%S).log"

# 检查参数
MODE=$1
if [[ "$MODE" != "--dry-run" && "$MODE" != "--confirm" ]]; then
    echo -e "${RED}请使用 --dry-run 或 --confirm 参数${NC}"
    exit 1
fi

# 记录日志
exec > >(tee -a "$LOG_FILE") 2>&1

echo -e "${YELLOW}开始清理检查...${NC}"
echo "运行模式: $MODE"
echo "时间: $(date)"
echo "工作目录: $PROJECT_ROOT"
echo

# 定义要清理的文件模式
declare -a PATTERNS_TO_REMOVE=(
    # 重复文档
    "docs/workflow.md"
    "docs/development/workflow.md"
    "docs/deployment/deployment.md"
    "docs/devinreadme.md"
    
    # 临时文件
    "*.tmp"
    "*.bak"
    "*.old"
    "*.clean"
    
    # 重复配置
    "tsconfig.app.json"
    "tsconfig.node.json"
    "vite.config.js"
    "requirements.consolidated.txt"
    "requirements.core.txt"
    
    # 工具文件
    "black"
    "blackd"
    "flake8"
    "pip*"
    "wheel"
    "*.1"
    
    # DeFi Agent相关文件
    "defi_agent*.py"
    "defi_*.py"
    "*defi_agent*"
    "*defi_strategy*"
)

# 定义要删除的目录
declare -a DIRS_TO_REMOVE=(
    "scripts/src/defi_agent"
    "src/defi_agent"
    "tests/defi_agent"
    "docs/defi_agent"
)

# 定义关键目录（不会被删除）
declare -a PROTECTED_DIRS=(
    "src/backend/core"
    "src/backend/services"
    "src/frontend"
    "src/shared"
    "docs/architecture"
    "config"
    "tests"
    ".git"
)

# 创建备份
if [[ "$MODE" == "--confirm" ]]; then
    echo -e "${YELLOW}创建备份...${NC}"
    BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).tar.gz"
    
    # 创建排除文件列表
    EXCLUDE_FILE=$(mktemp)
    echo "*.tmp" > "$EXCLUDE_FILE"
    echo "*.bak" >> "$EXCLUDE_FILE"
    echo "*.pyc" >> "$EXCLUDE_FILE"
    echo "node_modules" >> "$EXCLUDE_FILE"
    echo ".git" >> "$EXCLUDE_FILE"
    
    tar -czf "$BACKUP_FILE" \
        -X "$EXCLUDE_FILE" \
        src/ docs/ config/ scripts/
    
    rm -f "$EXCLUDE_FILE"
    
    echo "备份文件: $BACKUP_FILE"
    echo "备份SHA256校验和:"
    shasum -a 256 "$BACKUP_FILE"
    echo
fi

# 删除指定目录
echo -e "${YELLOW}删除指定目录...${NC}"
for dir in "${DIRS_TO_REMOVE[@]}"; do
    if [ -d "$dir" ]; then
        echo "删除目录: $dir"
        if [[ "$MODE" == "--confirm" ]]; then
            rm -rf "$dir"
        fi
    fi
done

# 查找并处理文件
echo -e "${YELLOW}查找匹配的文件...${NC}"
for pattern in "${PATTERNS_TO_REMOVE[@]}"; do
    echo "检查模式: $pattern"
    if [[ "$MODE" == "--dry-run" ]]; then
        find . -type f -name "$pattern" -not -path "./.git/*" -not -path "*/node_modules/*" -print
    else
        find . -type f -name "$pattern" -not -path "./.git/*" -not -path "*/node_modules/*" -print -delete
    fi
done

# 清理空目录（排除受保护的目录）
echo -e "${YELLOW}查找空目录...${NC}"
EXCLUDE_PATTERN=$(printf " -not -path './%s/*'" "${PROTECTED_DIRS[@]}")
EXCLUDE_PATTERN="$EXCLUDE_PATTERN -not -path '*/node_modules/*'"

if [[ "$MODE" == "--dry-run" ]]; then
    eval "find . -type d -empty $EXCLUDE_PATTERN -print"
else
    eval "find . -type d -empty $EXCLUDE_PATTERN -print -delete"
fi

# 验证系统完整性
echo -e "${YELLOW}验证系统完整性...${NC}"
declare -a REQUIRED_DIRS=(
    "src/backend/core"
    "src/backend/services"
    "src/frontend"
    "src/shared"
    "docs/architecture"
    "config"
    "tests"
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

echo
if [[ "$MODE" == "--dry-run" ]]; then
    echo -e "${GREEN}清理检查完成。使用 --confirm 参数执行实际清理。${NC}"
else
    echo -e "${GREEN}清理完成！${NC}"
    echo "清理日志已保存到: $LOG_FILE"
    echo "备份文件: $BACKUP_FILE"
fi 