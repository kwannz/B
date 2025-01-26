# 交易机器人系统

一个支持多代理的自动化交易系统，具有灵活的策略管理和实时监控功能。

## 系统架构

### 后端结构
```
src/
├── api_gateway/                # API网关服务
│   └── app/
│       ├── main.py            # 主应用程序入口
│       ├── models/            # 数据模型
│       │   ├── base_model.py
│       │   └── agent_models.py
│       └── routes/            # API路由
│           └── agent_routes.py
│
└── trading_agent/             # 交易代理服务
    ├── agents/                # 代理实现
    │   ├── base_agent.py      # 基础代理类
    │   └── trading_agent.py   # 交易代理实现
    ├── services/              # 业务服务
    │   └── agent_manager.py   # 代理管理服务
    ├── strategies/            # 交易策略
    └── utils/                 # 工具函数
```

### 前端结构
```
frontend/trading-ui/
└── src/
    ├── components/
    │   ├── agents/           # 代理相关组件
    │   │   ├── AgentCard.jsx    # 单个代理显示
    │   │   ├── AgentsList.jsx   # 代理列表
    │   │   ├── AddAgentModal.jsx
    │   │   └── EditAgentModal.jsx
    │   ├── steps/            # 步骤组件
    │   └── ui/              # 通用UI组件
    ├── services/            # API服务
    └── hooks/              # 自定义Hooks
```

## 快速开始

### 测试覆盖率要求
- 系统要求保持90%以上的测试覆盖率
- 所有核心功能必须有对应的单元测试
- 测试包括：
  - 基础代理功能测试
  - 交易代理实现测试
  - 代理管理服务测试
  - API端点集成测试

### 运行测试
```bash
# 安装测试依赖
pip install pytest pytest-asyncio pytest-cov

# 运行测试并生成覆盖率报告
pytest --cov=src --cov-report=html

# 查看覆盖率报告
open htmlcov/index.html
```

### 环境要求
- Python 3.8+
- Node.js 16+
- npm 或 yarn

### 后端部署

1. 创建并激活Python虚拟环境
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或
.\venv\Scripts\activate  # Windows
```

2. 安装依赖
```bash
pip install -r requirements.txt
```

3. 启动API网关
```bash
cd src/api_gateway
uvicorn app.main:app --reload --port 8000
```

### 前端部署

1. 安装依赖
```bash
cd frontend/trading-ui
npm install
# 或
yarn install
```

2. 启动开发服务器
```bash
npm run dev
# 或
yarn dev
```

访问 http://localhost:5173 查看前端界面

## 功能特性

### 多代理管理
- 创建和配置多个交易代理
- 实时监控代理状态
- 灵活的策略配置

### API接口
- RESTful API设计
- 完整的代理生命周期管理
- 健康检查和监控

### 用户界面
- 响应式设计
- 实时状态更新
- 直观的代理管理界面

## 开发指南

### 添加新的代理类型

1. 在 `src/trading_agent/agents` 创建新的代理类：
```python
from .base_agent import BaseAgent

class NewAgent(BaseAgent):
    async def start(self):
        # 实现启动逻辑
        pass

    async def stop(self):
        # 实现停止逻辑
        pass

    async def update_config(self, new_config):
        # 实现配置更新逻辑
        pass
```

2. 在 `agent_manager.py` 中注册新代理类型

### 添加新的API端点

1. 在 `src/api_gateway/app/routes` 添加新路由
2. 在 `main.py` 中注册路由
3. 在前端 `services` 中添加对应的API调用

## 部署说明

### 生产环境部署

1. 配置环境变量
```bash
export TRADING_ENV=production
export API_KEY=your_api_key
```

2. 构建前端
```bash
cd frontend/trading-ui
npm run build
# 或
yarn build
```

3. 使用生产服务器
```bash
cd src/api_gateway
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Docker部署

1. 构建镜像
```bash
docker-compose build
```

2. 启动服务
```bash
docker-compose up -d
```

## 维护和监控

### 测试和质量保证
- 定期运行测试套件确保代码质量
- 监控测试覆盖率变化
- 新功能必须包含测试用例
- 运行 `pytest --cov=src` 检查覆盖率

### 日志管理
- API网关日志位于 `logs/api_gateway.log`
- 交易代理日志位于 `logs/trading_agent.log`

### 健康检查
- 访问 `/health` 端点检查系统状态
- 监控代理状态页面查看详细信息

## 常见问题

1. 如何重置代理状态？
   - 使用API的 `/api/v1/agents/{agent_id}/reset` 端点
   - 或通过UI的重置按钮

2. 如何备份配置？
   - 配置文件位于 `config/` 目录
   - 定期备份该目录

3. 如何扩展系统？
   - 遵循模块化设计添加新功能
   - 参考开发指南进行扩展

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 发起 Pull Request

## 许可证

MIT License
