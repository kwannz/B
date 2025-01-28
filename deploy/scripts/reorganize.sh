#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 获取项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo -e "${BLUE}开始重组项目结构...${NC}"

# 创建目录结构
echo -e "${BLUE}创建目录结构...${NC}"
mkdir -p src/trading_bot/{python/{dex,analysis,models,strategies},go,web,config,scripts,docs}
mkdir -p src/defi_agent/{python/{models,protocols,strategies,analysis},web,config,scripts,docs}

# Trading Bot文件移动
echo -e "${BLUE}移动Trading Bot文件...${NC}"

# Python文件
echo "移动Python文件..."
if [ -f "src/python/trading_ai.py" ]; then
    cp src/python/trading_ai.py src/trading_bot/python/
fi

if [ -d "src/python/dex" ]; then
    cp -r src/python/dex/* src/trading_bot/python/dex/
fi

if [ -d "src/python/analysis" ]; then
    cp -r src/python/analysis/* src/trading_bot/python/analysis/
fi

# Go文件
echo "移动Go文件..."
if [ -d "src/go" ]; then
    cp -r src/go/* src/trading_bot/go/
fi

# Web文件
echo "移动Web文件..."
if [ -d "src/web" ]; then
    cp -r src/web/* src/trading_bot/web/
fi

# 配置文件
echo "移动配置文件..."
if [ -f "config/.env.example" ]; then
    cp config/.env.example src/trading_bot/config/
fi
if [ -f "config/.env" ]; then
    cp config/.env src/trading_bot/config/
fi

# 脚本文件
echo "移动脚本文件..."
for script in start_bot.sh stop_bot.sh monitor.sh; do
    if [ -f "src/scripts/$script" ]; then
        cp "src/scripts/$script" "src/trading_bot/scripts/"
    fi
done

# 文档文件
echo "移动文档文件..."
for doc in api.md development.md deployment.md workflow.md; do
    if [ -f "docs/$doc" ]; then
        cp "docs/$doc" "src/trading_bot/docs/"
    fi
done

# DeFi AI Agent文件移动
echo -e "${BLUE}移动DeFi AI Agent文件...${NC}"

# 移动DeFi Agent特定文件
echo "移动DeFi Agent文件..."
if [ -f "src/defi_agent/python/defi_ai_agent.py" ]; then
    cp src/defi_agent/python/defi_ai_agent.py src/defi_agent/python/
fi

if [ -d "src/defi_agent/python/models" ]; then
    cp -r src/defi_agent/python/models/* src/defi_agent/python/models/
fi

if [ -f "src/defi_agent/config/.env.example" ]; then
    cp src/defi_agent/config/.env.example src/defi_agent/config/
fi

# 创建新的requirements.txt文件
echo "创建requirements.txt文件..."

# Trading Bot requirements
cat > src/trading_bot/requirements.txt << EOL
# Trading Bot Dependencies
numpy==1.26.3
pandas==2.2.0
scikit-learn==1.4.0
tensorflow==2.15.0
pytorch==2.1.2
fastapi==0.109.0
uvicorn==0.27.0
websockets==12.0
python-binance==1.0.19
ccxt==4.2.15
pandas-ta==0.3.14b
python-dotenv==1.0.0
EOL

# DeFi Agent requirements
cat > src/defi_agent/requirements.txt << EOL
# DeFi AI Agent Dependencies
web3==6.14.0
eth-account==0.11.0
solana==0.32.0
anchorpy==0.19.0
aave-v3-py==0.5.0
compound-v3-py==0.5.0
uniswap-python==0.7.1
curve-python==0.2.0
deepseek-ai==0.1.0
python-dotenv==1.0.0
fastapi==0.109.0
uvicorn==0.27.0
sqlalchemy==2.0.25
aiosqlite==0.19.0
EOL

echo -e "${GREEN}项目重组完成！${NC}"
echo
echo -e "${BLUE}新的项目结构：${NC}"
ls -R src/trading_bot src/defi_agent

# 清理原始文件
echo -e "${YELLOW}是否要删除原始文件？(y/N)${NC}"
read -r response
if [[ "$response" =~ ^[Yy]$ ]]; then
    echo "清理原始文件..."
    rm -rf src/python src/go src/web src/scripts config/
    echo "清理完成"
fi
