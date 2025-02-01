#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查Docker环境
check_docker() {
    log_info "检查Docker环境..."
    
    # 检查Docker是否安装
    if ! command -v docker >/dev/null 2>&1; then
        log_error "Docker未安装"
        exit 1
    fi
    
    # 检查Docker Compose是否安装
    if ! command -v docker-compose >/dev/null 2>&1; then
        log_error "Docker Compose未安装"
        exit 1
    fi
    
    # 检查Docker服务是否运行
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker服务未运行"
        exit 1
    fi
    
    log_info "Docker环境检查通过"
}

# 构建Docker镜像
build_images() {
    log_info "构建Docker镜像..."
    
    # 构建所有服务
    if ! docker-compose -f config/docker/docker-compose.yml build; then
        log_error "镜像构建失败"
        exit 1
    fi
    
    log_info "镜像构建成功"
}

# 启动服务
start_services() {
    log_info "启动服务..."
    
    # 停止现有服务
    docker-compose -f config/docker/docker-compose.yml down
    
    # 启动服务
    if ! docker-compose -f config/docker/docker-compose.yml up -d; then
        log_error "服务启动失败"
        exit 1
    fi
    
    # 等待服务启动
    log_info "等待服务启动..."
    sleep 30
}

# 检查服务健康状态
check_services_health() {
    log_info "检查服务健康状态..."
    
    local services=(
        "api"
        "frontend"
        "executor"
        "mongodb"
        "postgres"
        "redis"
        "prometheus"
        "grafana"
    )
    
    for service in "${services[@]}"; do
        if [ "$(docker-compose -f config/docker/docker-compose.yml ps -q $service)" ]; then
            if [ "$(docker inspect -f {{.State.Health.Status}} $(docker-compose -f config/docker/docker-compose.yml ps -q $service))" = "healthy" ]; then
                log_info "✓ 服务 $service 运行正常"
            else
                log_error "✗ 服务 $service 状态异常"
            fi
        else
            log_error "✗ 服务 $service 未运行"
        fi
    done
}

# 检查网络连接
check_network() {
    log_info "检查网络连接..."
    
    local endpoints=(
        "http://localhost:${API_PORT}/health"
        "http://localhost:${FRONTEND_PORT}"
        "http://localhost:${TRADING_PORT}/health"
        "http://localhost:${PROMETHEUS_PORT}/-/healthy"
        "http://localhost:${GRAFANA_PORT}/api/health"
    )
    
    for endpoint in "${endpoints[@]}"; do
        if curl -sf "$endpoint" >/dev/null 2>&1; then
            log_info "✓ 端点 $endpoint 可访问"
        else
            log_error "✗ 端点 $endpoint 无法访问"
        fi
    done
}

# 检查日志
check_logs() {
    log_info "检查容器日志..."
    
    local services=(
        "api"
        "frontend"
        "executor"
    )
    
    for service in "${services[@]}"; do
        if docker-compose -f config/docker/docker-compose.yml logs --tail=10 $service | grep -i "error\|exception\|fail" >/dev/null; then
            log_warn "⚠ 服务 $service 日志中发现错误"
        else
            log_info "✓ 服务 $service 日志正常"
        fi
    done
}

# 检查资源使用
check_resources() {
    log_info "检查资源使用..."
    
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
}

# 执行集成测试
run_integration_tests() {
    log_info "执行集成测试..."
    
    # 运行测试
    if ! docker-compose -f tests/docker-compose.test.yml up --abort-on-container-exit; then
        log_error "集成测试失败"
        return 1
    fi
    
    log_info "集成测试通过"
    return 0
}

# 清理资源
cleanup() {
    log_info "清理资源..."
    
    # 停止并删除容器
    docker-compose -f config/docker/docker-compose.yml down --volumes --remove-orphans
    
    # 清理未使用的镜像和卷
    docker system prune -f
    docker volume prune -f
}

# 主函数
main() {
    log_info "开始Docker部署测试...\n"
    
    # 检查环境
    check_docker
    
    # 构建和启动
    build_images
    start_services
    
    # 运行测试
    check_services_health
    check_network
    check_logs
    check_resources
    
    # 执行集成测试
    if ! run_integration_tests; then
        log_error "测试失败,开始清理..."
        cleanup
        exit 1
    fi
    
    log_info "\n测试完成!"
    
    # 询问是否清理资源
    read -p "是否清理测试资源? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cleanup
    fi
}

# 执行主函数
main
