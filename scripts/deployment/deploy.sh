#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 检查参数
if [ "$#" -ne 1 ] || [[ "$1" != "staging" && "$1" != "production" ]]; then
    echo -e "${RED}使用方法: $0 [staging|production]${NC}"
    exit 1
fi

ENVIRONMENT=$1
echo -e "${YELLOW}开始部署到 $ENVIRONMENT 环境...${NC}"

# 获取项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

# 验证项目结构
echo -e "${YELLOW}验证项目结构...${NC}"
./scripts/verify_structure.sh || exit 1

# 设置环境变量
if [ "$ENVIRONMENT" == "production" ]; then
    CLUSTER_NAME="trading-bot-prod"
    MIN_NODES=2
    MAX_NODES=5
else
    CLUSTER_NAME="trading-bot-staging"
    MIN_NODES=1
    MAX_NODES=3
fi

# 更新 EKS 集群
echo -e "${YELLOW}更新 Kubernetes 集群配置...${NC}"
aws eks update-kubeconfig --name $CLUSTER_NAME

# 应用配置
echo -e "${YELLOW}应用 Kubernetes 配置...${NC}"
kubectl apply -f deploy/k8s/common/
kubectl apply -f deploy/k8s/$ENVIRONMENT/

# 更新服务
echo -e "${YELLOW}更新服务...${NC}"
services=("api-gateway" "trading-agent" "frontend")
for service in "${services[@]}"; do
    echo -e "${YELLOW}部署 $service...${NC}"
    kubectl set image deployment/$service $service=$DOCKER_HUB_USERNAME/trading-bot-$service:$GITHUB_SHA -n $ENVIRONMENT
    
    # 等待部署完成
    kubectl rollout status deployment/$service -n $ENVIRONMENT --timeout=300s
    if [ $? -ne 0 ]; then
        echo -e "${RED}$service 部署失败${NC}"
        exit 1
    fi
done

# 运行数据库迁移
if [ "$ENVIRONMENT" == "production" ]; then
    echo -e "${YELLOW}运行数据库迁移...${NC}"
    kubectl apply -f deploy/k8s/jobs/db-migrate.yaml
    kubectl wait --for=condition=complete job/db-migrate -n $ENVIRONMENT --timeout=300s
fi

# 验证部署
echo -e "${YELLOW}验证部署...${NC}"
for service in "${services[@]}"; do
    READY=$(kubectl get deployment $service -n $ENVIRONMENT -o jsonpath='{.status.readyReplicas}')
    DESIRED=$(kubectl get deployment $service -n $ENVIRONMENT -o jsonpath='{.status.replicas}')
    
    if [ "$READY" != "$DESIRED" ]; then
        echo -e "${RED}$service 部署验证失败: $READY/$DESIRED 个副本就绪${NC}"
        exit 1
    fi
done

# 配置自动扩缩容
echo -e "${YELLOW}配置自动扩缩容...${NC}"
kubectl apply -f - <<EOF
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: trading-bot-hpa
  namespace: $ENVIRONMENT
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: trading-agent
  minReplicas: $MIN_NODES
  maxReplicas: $MAX_NODES
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
EOF

echo -e "${GREEN}部署完成！${NC}"
echo "前端地址: https://$ENVIRONMENT.tradingbot.com"
echo "API地址: https://api.$ENVIRONMENT.tradingbot.com"
echo "监控面板: https://grafana.$ENVIRONMENT.tradingbot.com" 