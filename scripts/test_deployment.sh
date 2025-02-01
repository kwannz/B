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

# 测试结果追踪
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0

# 记录测试结果
record_test() {
    local test_name=$1
    local result=$2
    local message=$3
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$result" = "pass" ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        log_info "✓ $test_name: $message"
    elif [ "$result" = "warn" ]; then
        WARNINGS=$((WARNINGS + 1))
        log_warn "⚠ $test_name: $message"
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        log_error "✗ $test_name: $message"
    fi
}

# 检查系统要求
check_system_requirements() {
    log_info "检查系统要求..."
    
    # 检查Node.js版本
    if command -v node >/dev/null 2>&1; then
        node_version=$(node -v | cut -d'v' -f2)
        if [ "$(printf '%s\n' "18.0.0" "$node_version" | sort -V | head -n1)" = "18.0.0" ]; then
            record_test "Node.js版本" "pass" "Node.js $node_version"
        else
            record_test "Node.js版本" "fail" "需要Node.js 18+"
        fi
    else
        record_test "Node.js" "fail" "未安装Node.js"
    fi
    
    # 检查Python版本
    if command -v python3 >/dev/null 2>&1; then
        python_version=$(python3 --version | cut -d' ' -f2)
        if [ "$(printf '%s\n' "3.11.0" "$python_version" | sort -V | head -n1)" = "3.11.0" ]; then
            record_test "Python版本" "pass" "Python $python_version"
        else
            record_test "Python版本" "fail" "需要Python 3.11+"
        fi
    else
        record_test "Python" "fail" "未安装Python"
    fi
    
    # 检查Go版本
    if command -v go >/dev/null 2>&1; then
        go_version=$(go version | cut -d' ' -f3 | cut -d'o' -f2)
        if [ "$(printf '%s\n' "1.21" "$go_version" | sort -V | head -n1)" = "1.21" ]; then
            record_test "Go版本" "pass" "Go $go_version"
        else
            record_test "Go版本" "fail" "需要Go 1.21+"
        fi
    else
        record_test "Go" "fail" "未安装Go"
    fi
}

# 检查环境配置
check_environment() {
    log_info "检查环境配置..."
    
    # 检查环境变量文件
    if [ -f "config/.env" ]; then
        record_test "环境配置文件" "pass" "config/.env 存在"
        
        # 验证必要的环境变量
        source config/.env
        local required_vars=(
            "APP_ENV"
            "API_PORT"
            "TRADING_PORT"
            "FRONTEND_PORT"
            "MONGODB_URI"
            "REDIS_URI"
            "JWT_SECRET"
        )
        
        for var in "${required_vars[@]}"; do
            if [ -z "${!var}" ]; then
                record_test "环境变量 $var" "fail" "未设置"
            else
                record_test "环境变量 $var" "pass" "已配置"
            fi
        done
    else
        record_test "环境配置文件" "fail" "config/.env 不存在"
    fi
}

# 检查依赖项
check_dependencies() {
    log_info "检查依赖项..."
    
    # 检查前端依赖
    if [ -f "src/frontend/package.json" ]; then
        if [ -d "src/frontend/node_modules" ]; then
            record_test "前端依赖" "pass" "已安装"
        else
            record_test "前端依赖" "fail" "未安装"
        fi
    else
        record_test "前端依赖" "fail" "package.json不存在"
    fi
    
    # 检查Python依赖
    if [ -f "requirements.txt" ]; then
        if [ -d "venv" ]; then
            source venv/bin/activate
            if pip freeze | grep -q -f requirements.txt; then
                record_test "Python依赖" "pass" "已安装"
            else
                record_test "Python依赖" "warn" "可能不完整"
            fi
            deactivate
        else
            record_test "Python依赖" "fail" "虚拟环境不存在"
        fi
    else
        record_test "Python依赖" "fail" "requirements.txt不存在"
    fi
    
    # 检查Go依赖
    if [ -f "src/go_executor/go.mod" ]; then
        if [ -d "src/go_executor/vendor" ] || [ -d "$GOPATH/pkg/mod" ]; then
            record_test "Go依赖" "pass" "已安装"
        else
            record_test "Go依赖" "warn" "可能需要更新"
        fi
    else
        record_test "Go依赖" "fail" "go.mod不存在"
    fi
}

# 检查数据库连接
check_databases() {
    log_info "检查数据库连接..."
    
    # 检查MongoDB连接
    if command -v mongosh >/dev/null 2>&1; then
        if mongosh --eval "db.runCommand({ping: 1})" >/dev/null 2>&1; then
            record_test "MongoDB连接" "pass" "连接成功"
        else
            record_test "MongoDB连接" "fail" "连接失败"
        fi
    else
        record_test "MongoDB" "fail" "未安装MongoDB客户端"
    fi
    
    # 检查Redis连接
    if command -v redis-cli >/dev/null 2>&1; then
        if redis-cli ping >/dev/null 2>&1; then
            record_test "Redis连接" "pass" "连接成功"
        else
            record_test "Redis连接" "fail" "连接失败"
        fi
    else
        record_test "Redis" "fail" "未安装Redis客户端"
    fi
    
    # 检查PostgreSQL连接
    if command -v psql >/dev/null 2>&1; then
        if pg_isready >/dev/null 2>&1; then
            record_test "PostgreSQL连接" "pass" "连接成功"
        else
            record_test "PostgreSQL连接" "fail" "连接失败"
        fi
    else
        record_test "PostgreSQL" "fail" "未安装PostgreSQL客户端"
    fi
}

# 检查服务状态
check_services() {
    log_info "检查服务状态..."
    
    # 检查API服务
    if curl -s "http://localhost:${API_PORT}/health" >/dev/null 2>&1; then
        record_test "API服务" "pass" "运行正常"
    else
        record_test "API服务" "fail" "无法访问"
    fi
    
    # 检查前端服务
    if curl -s "http://localhost:${FRONTEND_PORT}" >/dev/null 2>&1; then
        record_test "前端服务" "pass" "运行正常"
    else
        record_test "前端服务" "fail" "无法访问"
    fi
    
    # 检查执行器服务
    if curl -s "http://localhost:${TRADING_PORT}/health" >/dev/null 2>&1; then
        record_test "执行器服务" "pass" "运行正常"
    else
        record_test "执行器服务" "fail" "无法访问"
    fi
    
    # 检查Prometheus
    if curl -s "http://localhost:${PROMETHEUS_PORT}/-/healthy" >/dev/null 2>&1; then
        record_test "Prometheus" "pass" "运行正常"
    else
        record_test "Prometheus" "warn" "无法访问"
    fi
    
    # 检查Grafana
    if curl -s "http://localhost:${GRAFANA_PORT}/api/health" >/dev/null 2>&1; then
        record_test "Grafana" "pass" "运行正常"
    else
        record_test "Grafana" "warn" "无法访问"
    fi
}

# 检查日志文件
check_logs() {
    log_info "检查日志文件..."
    
    local log_dir="/var/log/tradingbot"
    
    # 检查日志目录
    if [ -d "$log_dir" ]; then
        record_test "日志目录" "pass" "存在"
        
        # 检查日志文件权限
        if [ "$(stat -c %a $log_dir)" = "755" ]; then
            record_test "日志目录权限" "pass" "正确"
        else
            record_test "日志目录权限" "warn" "建议设置为755"
        fi
        
        # 检查日志文件
        local log_files=("app.log" "error.log" "access.log")
        for log_file in "${log_files[@]}"; do
            if [ -f "$log_dir/$log_file" ]; then
                if [ -w "$log_dir/$log_file" ]; then
                    record_test "日志文件 $log_file" "pass" "可写"
                else
                    record_test "日志文件 $log_file" "warn" "不可写"
                fi
            else
                record_test "日志文件 $log_file" "warn" "不存在"
            fi
        done
    else
        record_test "日志目录" "fail" "不存在"
    fi
}

# 检查备份
check_backups() {
    log_info "检查备份..."
    
    local backup_dir="/data/backups"
    
    # 检查备份目录
    if [ -d "$backup_dir" ]; then
        record_test "备份目录" "pass" "存在"
        
        # 检查最近备份
        local latest_backup=$(ls -t "$backup_dir"/*.tar.gz 2>/dev/null | head -n1)
        if [ -n "$latest_backup" ]; then
            local backup_age=$(( ($(date +%s) - $(date -r "$latest_backup" +%s)) / 86400 ))
            if [ "$backup_age" -lt 2 ]; then
                record_test "最近备份" "pass" "$(basename "$latest_backup") ($backup_age 天前)"
            else
                record_test "最近备份" "warn" "$(basename "$latest_backup") ($backup_age 天前)"
            fi
        else
            record_test "备份文件" "warn" "未找到备份"
        fi
    else
        record_test "备份目录" "fail" "不存在"
    fi
}

# 检查安全配置
check_security() {
    log_info "检查安全配置..."
    
    # 检查SSL证书
    if [ "$ENABLE_SSL" = "true" ]; then
        if [ -f "$SSL_CERT_PATH" ] && [ -f "$SSL_KEY_PATH" ]; then
            record_test "SSL证书" "pass" "已配置"
        else
            record_test "SSL证书" "fail" "证书文件不存在"
        fi
    else
        record_test "SSL" "warn" "未启用"
    fi
    
    # 检查JWT密钥
    if [ -n "$JWT_SECRET" ] && [ ${#JWT_SECRET} -ge 32 ]; then
        record_test "JWT密钥" "pass" "已配置且长度足够"
    else
        record_test "JWT密钥" "warn" "密钥长度不足"
    fi
    
    # 检查文件权限
    local sensitive_files=("config/.env" "*.key" "*.crt")
    for file in "${sensitive_files[@]}"; do
        if [ -f "$file" ]; then
            if [ "$(stat -c %a $file)" = "600" ]; then
                record_test "文件权限 $file" "pass" "正确"
            else
                record_test "文件权限 $file" "warn" "建议设置为600"
            fi
        fi
    done
}

# 生成报告
generate_report() {
    log_info "\n测试报告"
    echo "----------------------------------------"
    echo "总测试数: $TOTAL_TESTS"
    echo "通过: $PASSED_TESTS"
    echo "失败: $FAILED_TESTS"
    echo "警告: $WARNINGS"
    echo "----------------------------------------"
    
    # 计算通过率
    local pass_rate=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
    echo "通过率: $pass_rate%"
    
    # 输出建议
    if [ $FAILED_TESTS -gt 0 ]; then
        log_error "\n需要修复的问题:"
        echo "1. 检查并修复所有失败的测试项"
        echo "2. 确保所有必要的服务都已正确配置和启动"
        echo "3. 验证所有必需的依赖项都已正确安装"
    fi
    
    if [ $WARNINGS -gt 0 ]; then
        log_warn "\n建议改进的项目:"
        echo "1. 检查并处理所有警告信息"
        echo "2. 考虑升级安全配置"
        echo "3. 确保备份策略的有效性"
    fi
}

# 主函数
main() {
    log_info "开始系统测试...\n"
    
    # 运行所有检查
    check_system_requirements
    check_environment
    check_dependencies
    check_databases
    check_services
    check_logs
    check_backups
    check_security
    
    # 生成报告
    generate_report
    
    # 返回状态码
    if [ $FAILED_TESTS -gt 0 ]; then
        exit 1
    else
        exit 0
    fi
}

# 执行主函数
main
