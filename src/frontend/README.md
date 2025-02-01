# 前端应用

TradingBot的React前端应用,提供交易界面、监控面板和系统管理功能。

## 🚀 快速开始

### 环境要求
- Node.js 18+
- npm 8+
- TypeScript 5+

### 安装依赖
```bash
# 安装依赖
npm install

# 或使用pnpm
pnpm install
```

### 开发服务器
```bash
# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 运行测试
npm test
```

## 📁 项目结构

```
frontend/
├── src/                 # 源代码
│   ├── app/            # 应用核心
│   │   ├── components/ # 组件
│   │   ├── config/     # 配置
│   │   ├── contexts/   # 上下文
│   │   └── services/   # 服务
│   ├── assets/         # 静态资源
│   ├── styles/         # 样式文件
│   └── utils/          # 工具函数
├── public/             # 公共文件
├── tests/              # 测试文件
└── types/              # 类型定义
```

## 🎨 主要功能

### 1. 调试面板 (DebugMetricsDashboard)
- 系统监控
- 模型监控
- 性能指标
- 日志查看

### 2. 交易界面
- 市场数据展示
- 订单管理
- 仓位管理
- 风险控制

### 3. 配置管理
- 系统设置
- 策略配置
- 模型参数
- 风险参数

## 🔧 技术栈

### 核心框架
- React 18
- TypeScript
- Vite
- TailwindCSS

### UI组件
- Material-UI
- Recharts
- TailwindCSS

### 状态管理
- React Context
- React Query
- Zustand

### 开发工具
- ESLint
- Prettier
- Vitest
- React Testing Library

## 📦 组件说明

### 1. 调试组件

#### DebugMetricsDashboard
```typescript
import { DebugMetricsDashboard } from './components/DebugMetricsDashboard';

// 使用组件
<DebugMetricsDashboard />
```

配置选项:
```typescript
interface DebugMetricsProps {
  refreshInterval?: number;  // 刷新间隔(ms)
  showCharts?: boolean;     // 显示图表
  showLogs?: boolean;       // 显示日志
}
```

#### SystemDebugInfo
```typescript
import { SystemDebugInfo } from './components/SystemDebugInfo';

// 使用组件
<SystemDebugInfo />
```

监控指标:
- CPU使用率
- 内存使用
- 磁盘IO
- 网络流量

#### ModelDebugInfo
```typescript
import { ModelDebugInfo } from './components/ModelDebugInfo';

// 使用组件
<ModelDebugInfo />
```

模型指标:
- 请求统计
- 响应时间
- 错误率
- Token使用量

### 2. 服务集成

#### 模型服务
```typescript
import { modelService } from './services/modelService';

// 使用服务
const response = await modelService.generateText(prompt);
```

#### 调试服务
```typescript
import { useDebug } from './contexts/DebugContext';

// 使用Hook
const { isDebugMode, log } = useDebug();
```

## 🔒 安全措施

### 1. API安全
- HTTPS传输
- JWT认证
- CORS配置
- 请求加密

### 2. 数据安全
- 本地存储加密
- 敏感信息脱敏
- 会话管理
- XSS防护

## 🧪 测试

### 单元测试
```bash
# 运行所有测试
npm test

# 运行特定测试
npm test DebugMetrics
```

### E2E测试
```bash
# 运行E2E测试
npm run test:e2e
```

### 测试覆盖率
```bash
# 生成覆盖率报告
npm run test:coverage
```

## 📊 性能优化

### 1. 代码分割
```typescript
// 动态导入
const DebugPanel = lazy(() => import('./components/DebugPanel'));
```

### 2. 性能监控
```typescript
// 使用性能Hook
const metrics = usePerformanceMetrics();
```

### 3. 缓存策略
```typescript
// 使用React Query
const { data } = useQuery(['metrics'], fetchMetrics, {
  staleTime: 60000,
  cacheTime: 3600000
});
```

## 🚀 部署

### 开发环境
```bash
# 启动开发服务器
npm run dev
```

### 生产环境
```bash
# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

## 📝 开发规范

### 1. 代码风格
- 使用TypeScript
- 遵循ESLint规则
- 使用Prettier格式化
- 编写注释和文档

### 2. 组件规范
- 函数组件
- 使用Hooks
- Props类型定义
- 错误边界处理

### 3. 状态管理
- Context适度使用
- 合理的状态分层
- 避免状态冗余
- 性能优化考虑

## 🔍 故障排除

### 1. 开发问题
```bash
# 清理依赖
rm -rf node_modules
npm install

# 清理缓存
npm run clean
```

### 2. 构建问题
```bash
# 检查类型
npm run type-check

# 构建调试
npm run build --debug
```

### 3. 测试问题
```bash
# 更新快照
npm test -- -u

# 调试测试
npm run test:debug
