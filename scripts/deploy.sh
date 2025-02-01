#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 获取项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# 环境变量
ENV=${1:-production}
DOCKER_REGISTRY="your-registry.com"
VERSION=$(cat VERSION || echo "0.0.1")

# 构建Docker镜像
build_images() {
    echo -e "${YELLOW}构建Docker镜像...${NC}"
    
    # 构建后端镜像
    docker build -t $DOCKER_REGISTRY/trading-bot-backend:$VERSION \
        -f deploy/docker/Dockerfile.backend .
        
    # 构建前端镜像
    docker build -t $DOCKER_REGISTRY/trading-bot-frontend:$VERSION \
        -f deploy/docker/Dockerfile.frontend .
        
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Docker镜像构建成功${NC}"
    else
        echo -e "${RED}Docker镜像构建失败${NC}"
        exit 1
    fi
}

# 推送Docker镜像
push_images() {
    echo -e "${YELLOW}推送Docker镜像...${NC}"
    
    docker push $DOCKER_REGISTRY/trading-bot-backend:$VERSION
    docker push $DOCKER_REGISTRY/trading-bot-frontend:$VERSION
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Docker镜像推送成功${NC}"
    else
        echo -e "${RED}Docker镜像推送失败${NC}"
        exit 1
    fi
}

# 部署应用
deploy_app() {
    echo -e "${YELLOW}部署应用到 $ENV 环境...${NC}"
    
    # 替换环境变量
    envsubst < deploy/k8s/$ENV/deployment.yaml > deploy/k8s/$ENV/deployment_processed.yaml
    
    # 应用Kubernetes配置
    kubectl apply -f deploy/k8s/$ENV/namespace.yaml
    kubectl apply -f deploy/k8s/$ENV/configmap.yaml
    kubectl apply -f deploy/k8s/$ENV/secret.yaml
    kubectl apply -f deploy/k8s/$ENV/deployment_processed.yaml
    kubectl apply -f deploy/k8s/$ENV/service.yaml
    kubectl apply -f deploy/k8s/$ENV/ingress.yaml
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}应用部署成功${NC}"
    else
        echo -e "${RED}应用部署失败${NC}"
        exit 1
    fi
}

# 验证部署
verify_deployment() {
    echo -e "${YELLOW}验证部署...${NC}"
    
    # 等待Pod就绪
    kubectl wait --for=condition=ready pod -l app=trading-bot -n $ENV --timeout=300s
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}部署验证成功${NC}"
    else
        echo -e "${RED}部署验证失败${NC}"
        exit 1
    fi
}

# 主流程
main() {
    echo -e "${YELLOW}开始部署流程...${NC}"
    
    # 检查必要工具
    command -v docker >/dev/null 2>&1 || { echo -e "${RED}需要docker但未安装${NC}" >&2; exit 1; }
    command -v kubectl >/dev/null 2>&1 || { echo -e "${RED}需要kubectl但未安装${NC}" >&2; exit 1; }
    
    # 执行部署步骤
    build_images
    push_images
    deploy_app
    verify_deployment
    
    echo -e "${GREEN}部署流程完成!${NC}"
}

# 运行主流程
main 