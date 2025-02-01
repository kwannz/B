# TradingBot

一个基于 FastAPI 和 React 的现代化交易机器人系统。

## 功能特点

- 🚀 高性能交易引擎
- 📊 实时市场数据分析
- 🤖 AI 驱动的交易策略
- 🔒 安全的多租户支持
- 📈 完整的监控系统
- 🔄 自动风险管理

## 技术栈

### 后端
- FastAPI
- MongoDB
- Redis
- gRPC
- Prometheus

### 前端
- React
- TypeScript
- TailwindCSS
- React Query
- Recharts

## 目录结构

```
tradingbot/
├── src/                # 源代码
│   ├── frontend/      # 前端代码
│   ├── backend/       # 后端代码
│   └── shared/        # 共享代码
├── tests/             # 测试文件
│   ├── unit/         # 单元测试
│   ├── integration/  # 集成测试
│   └── e2e/          # 端到端测试
├── config/            # 配置文件
├── docs/             # 文档
└── scripts/          # 脚本文件
```

## 快速开始

### 使用 Docker

```bash
# 克隆仓库
git clone https://github.com/yourusername/tradingbot.git
cd tradingbot

# 启动服务
docker-compose up -d
```

### 本地开发

1. 安装依赖:
```bash
# 后端
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 前端
cd frontend
npm install
```

2. 启动服务:
```bash
# 后端
uvicorn src.backend.main:app --reload

# 前端
npm run dev
```

## 文档

- [API文档](docs/api/README.md)
- [部署指南](docs/deployment/README.md)
- [开发指南](docs/development/README.md)
- [贡献指南](CONTRIBUTING.md)

## 测试

```bash
# 运行所有测试
pytest

# 运行特定测试
pytest tests/unit/
pytest tests/integration/
pytest tests/e2e/
```

## 监控

- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3000`

## 贡献

欢迎贡献代码！请查看 [贡献指南](CONTRIBUTING.md)。

## 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。 