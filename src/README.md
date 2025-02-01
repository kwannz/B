# 源代码说明

本目录包含TradingBot的所有源代码。以下是各模块的详细说明。

## 📁 目录结构

```
src/
├── data/               # 数据处理模块
│   ├── processors/    # 数据处理器
│   └── realtime_processor.py  # 实时数据处理
├── features/          # 特征工程
│   └── calculators.py # 指标计算器
├── frontend/          # 前端应用
│   ├── src/          # React源码
│   ├── components/   # UI组件
│   └── services/     # 前端服务
├── go_executor/       # Go交易执行器
│   ├── engine.go     # 执行引擎
│   └── executor/     # 执行器实现
├── monitoring/        # 监控系统
├── system/           # 系统核心
└── visualization/    # 数据可视化
```

## 🔍 模块说明

### 1. 数据处理模块 (data/)

负责处理各类数据源的数据:
- 市场数据处理
- 订单数据处理
- 实时数据流处理
- 历史数据分析

关键文件:
- `realtime_processor.py`: 实时数据处理器
- `processors/`: 各类数据处理器实现

### 2. 特征工程 (features/)

实现各种交易指标和特征:
- 技术指标计算
- 市场特征提取
- 信号生成器

关键文件:
- `calculators.py`: 指标计算实现

### 3. 前端应用 (frontend/)

React前端应用:
- 交易界面
- 监控面板
- 配置管理
- 数据可视化

主要组件:
- 调试面板 (DebugMetricsDashboard)
- 系统监控 (SystemDebugInfo)
- 模型监控 (ModelDebugInfo)
- 性能指标 (PerformanceMetrics)

### 4. Go交易执行器 (go_executor/)

高性能交易执行系统:
- 订单执行
- 风险控制
- 性能优化

关键组件:
- `engine.go`: 核心执行引擎
- `executor/`: 具体执行器实现

### 5. 监控系统 (monitoring/)

系统监控和指标收集:
- 性能指标
- 健康检查
- 告警系统

### 6. 系统核心 (system/)

核心业务逻辑:
- 交易策略
- 风险管理
- 资产管理

### 7. 数据可视化 (visualization/)

数据展示和分析工具:
- 图表生成
- 报表系统
- 实时展示

## 🔧 开发指南

### 环境要求

- Python 3.11+
- Go 1.21+
- Node.js 18+
- PostgreSQL
- MongoDB
- Redis

### 开发设置

1. Python环境:
```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

2. Go环境:
```bash
cd go_executor
go mod download
```

3. 前端环境:
```bash
cd frontend
npm install
```

### 代码规范

1. Python代码规范:
- 使用Black格式化
- 遵循PEP 8
- 类型注解
- 完整文档字符串

2. Go代码规范:
- 使用gofmt
- 遵循Go官方规范
- 完整注释

3. TypeScript代码规范:
- ESLint配置
- Prettier格式化
- 类型定义

## 🧪 测试

### 单元测试
```bash
# Python测试
pytest tests/unit/

# Go测试
cd go_executor
go test ./...

# 前端测试
cd frontend
npm test
```

### 集成测试
```bash
pytest tests/integration/
```

## 📊 性能优化

### 关键指标
- 响应时间 < 100ms
- CPU使用率 < 70%
- 内存使用率 < 80%
- 错误率 < 0.1%

### 优化策略
1. 使用缓存
2. 异步处理
3. 批量操作
4. 数据预处理

## 🔒 安全措施

1. 数据安全
- 加密存储
- 安全传输
- 访问控制

2. 代码安全
- 依赖审查
- 代码扫描
- 安全测试

3. 运行时安全
- 错误处理
- 日志记录
- 监控告警

## 🚀 部署

### 开发环境
```bash
./scripts/run/run_local.sh
```

### 生产环境
```bash
./scripts/deploy.sh
```

## 📝 文档

每个模块都应包含:
1. README文件
2. API文档
3. 使用示例
4. 测试用例

## 🆘 故障排除

1. 日志检查
```bash
tail -f logs/app.log
```

2. 健康检查
```bash
curl http://localhost:8000/health
```

3. 指标查看
```bash
curl http://localhost:9090/metrics
