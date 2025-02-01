# TradingBot

基于AI驱动的现代化加密货币交易机器人系统,集成本地模型和云端API,提供高性能交易执行和实时风险管理。

## 🌟 核心特点

- 🤖 **AI驱动决策**
  - 本地优先的模型架构 (Ollama/DeepSeek)
  - 云端API作为备选方案
  - 多维度市场分析

- 📊 **实时监控**
  - 完整的调试指标面板
  - 系统性能监控
  - 模型性能跟踪
  - Prometheus + Grafana集成

- 🔒 **风险管理**
  - 实时风险评估
  - 多层级风险控制
  - 自动化风险缓解
  - 资金安全保护

- 🚀 **高性能引擎**
  - Go语言交易执行器
  - Python策略引擎
  - 实时数据处理
  - 高效缓存系统

## 🔧 技术栈

### 后端
- Python 3.11+
- Go 1.21+
- FastAPI
- PostgreSQL (结构化数据)
- MongoDB (非结构化数据)
- Redis (缓存)
- Prometheus (监控)

### 前端
- React 18
- TypeScript
- TailwindCSS
- Material-UI
- React Query
- Recharts

### AI/ML
- Ollama
- DeepSeek
- 自定义模型支持

## 📁 项目结构

```
tradingbot/
├── src/                    # 源代码
│   ├── frontend/          # React前端
│   ├── data/              # 数据处理
│   ├── features/          # 特征工程
│   ├── go_executor/       # Go交易执行器
│   ├── monitoring/        # 监控系统
│   ├── system/            # 系统核心
│   └── visualization/     # 数据可视化
├── tests/                 # 测试套件
│   ├── unit/             # 单元测试
│   ├── integration/      # 集成测试
│   └── local/            # 本地测试
├── config/               # 配置文件
├── docs/                # 文档
└── scripts/             # 工具脚本
```

## 🚀 快速开始

### 使用Docker

```bash
# 克隆仓库
git clone https://github.com/yourusername/tradingbot.git
cd tradingbot

# 配置环境变量
cp config/.env.example config/.env
# 编辑 .env 文件设置必要的环境变量

# 启动服务
docker-compose -f config/docker/docker-compose.dev.yml up -d
```

### 本地开发

1. 系统要求:
```bash
Python 3.11+
Go 1.21+
Node.js 18+
```

2. 安装依赖:
```bash
# Python依赖
python -m venv venv
source venv/bin/activate  # Windows: .\venv\Scripts\activate
pip install -r requirements.txt

# Go依赖
cd src/go_executor
go mod download

# 前端依赖
cd src/frontend
npm install
```

3. 启动服务:
```bash
# 后端服务
./scripts/run/run_local.sh

# 前端开发服务器
cd src/frontend
npm run dev
```

## 📚 文档

- [系统架构](docs/system_architecture.md)
- [API文档](docs/api/README.md)
- [部署指南](docs/deployment/README.md)
- [开发指南](docs/development/README.md)
- [安全说明](docs/security/README.md)

## 🧪 测试

```bash
# 运行所有测试
./scripts/run_tests.sh

# 运行特定测试
pytest tests/unit/
pytest tests/integration/
go test ./src/go_executor/...
```

## 📊 监控

访问以下地址查看系统监控:

- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3000`

### 调试模式

系统提供完整的调试功能:

1. 系统监控
   - CPU/内存使用率
   - 磁盘IO
   - 网络流量
   - 服务状态

2. 模型监控
   - 请求统计
   - 延迟监控
   - 错误率
   - Token使用量

3. 性能指标
   - 交易延迟
   - 订单执行率
   - 系统吞吐量

## 🤝 贡献

欢迎贡献代码!请查看[贡献指南](CONTRIBUTING.md)了解详情。

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

## 🆘 支持

- 文档:查看 [docs/](docs/) 目录
- 问题:提交 GitHub Issues
- 讨论:参与 GitHub Discussions
- 更新:关注 [CHANGELOG.md](docs/CHANGELOG.md)
