#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 获取项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# 构建前端
build_frontend() {
    echo -e "${YELLOW}开始构建前端...${NC}"
    cd src/frontend
    
    # 安装依赖
    npm install
    
    # 构建生产版本
    npm run build
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}前端构建成功${NC}"
    else
        echo -e "${RED}前端构建失败${NC}"
        exit 1
    fi
    
    cd "$PROJECT_ROOT"
}

# 构建后端
build_backend() {
    echo -e "${YELLOW}开始构建后端...${NC}"
    
    # 创建虚拟环境
    python3 -m venv venv
    source venv/bin/activate
    
    # 安装依赖
    pip install -r requirements.txt
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}后端构建成功${NC}"
    else
        echo -e "${RED}后端构建失败${NC}"
        exit 1
    fi
    
    deactivate
}

# 运行测试
run_tests() {
    echo -e "${YELLOW}运行测试...${NC}"
    
    # 运行后端测试
    source venv/bin/activate
    pytest tests/
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}测试通过${NC}"
    else
        echo -e "${RED}测试失败${NC}"
        exit 1
    fi
    
    deactivate
}

# 主流程
main() {
    echo -e "${YELLOW}开始构建流程...${NC}"
    
    # 检查必要工具
    command -v python3 >/dev/null 2>&1 || { echo -e "${RED}需要python3但未安装${NC}" >&2; exit 1; }
    command -v npm >/dev/null 2>&1 || { echo -e "${RED}需要npm但未安装${NC}" >&2; exit 1; }
    
    # 执行构建步骤
    build_frontend
    build_backend
    run_tests
    
    echo -e "${GREEN}构建流程完成!${NC}"
}

# 运行主流程
main 