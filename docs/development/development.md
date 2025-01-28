# 开发指南

## 开发环境设置

1. 系统要求
   - Python 3.11+
   - Go 1.21+
   - Protocol Buffers
   - tmux

2. 初始化开发环境
```bash
# 安装依赖
./src/scripts/install_deps.sh

# 初始化项目
./src/scripts/init_project.sh

# 验证安装
./src/scripts/verify_install.sh
```

## 代码结构

### 回测模块 (src/shared/backtester.py)

1. 基本用法
```python
from src.shared.backtester import Backtester

# 初始化回测器
backtester = Backtester()
await backtester.initialize()

# 加载历史数据
await backtester.fetch_historical_data(
    symbol="BTC",
    start_date=datetime(2024, 1, 1),
    end_date=datetime(2024, 1, 31),
    interval="1h"
)

# 运行回测
strategy = {
    "type": "simple_ma",
    "params": {
        "short_window": 5,
        "long_window": 20
    }
}
result = await backtester.run_backtest(strategy)

# 获取性能指标
metrics = await backtester.get_performance_metrics()
```

2. 配置参数
```python
# 环境变量
COINGECKO_API_KEY="your_api_key"    # CoinGecko API密钥
BINANCE_API_KEY="your_api_key"      # Binance API密钥
INITIAL_BALANCE=10000               # 初始资金
TRADING_FEE=0.001                   # 交易费率
MIN_DATA_POINTS=100                 # 最小数据点数
```

3. 性能指标
- total_return: 总收益率
- max_drawdown: 最大回撤
- sharpe_ratio: 夏普比率
- win_rate: 胜率
- profit_factor: 盈亏比
- volatility: 波动率
- avg_trade_return: 平均每笔收益
- avg_win_return: 平均盈利
- avg_loss_return: 平均亏损

### 图表组件 (src/frontend/src/components/)

#### 环境变量配置
```bash
# API配置
REACT_APP_API_BASE_URL="http://localhost:8000"  # API基础URL
REACT_APP_API_TIMEOUT=10000                     # API超时时间(ms)
REACT_APP_METRICS_REFRESH=60000                 # 指标刷新间隔(ms)

# 性能指标配置
REACT_APP_MAX_DRAWDOWN_THRESHOLD=20             # 最大回撤阈值(%)
REACT_APP_RISK_HIGH_THRESHOLD=70                # 高风险阈值
REACT_APP_RISK_MEDIUM_THRESHOLD=30              # 中等风险阈值
REACT_APP_MIN_SHARPE_RATIO=0.5                  # 最小夏普比率
```

#### 组件配置

1. DrawdownChart: 回撤图表
```typescript
import { DrawdownChart } from '../components/DrawdownChart';

// 使用组件
<DrawdownChart 
  type="trading"    // 'trading' 或 'defi'
  height={300}      // 可选，默认300
/>

// 配置项
interface DrawdownChartProps {
  type: 'trading' | 'defi';
  height?: number;
  refreshInterval?: number;     // 刷新间隔，默认60秒
  maxDrawdown?: number;         // 最大回撤阈值，默认20%
}
```

2. RiskGauge: 风险仪表盘
```typescript
import { RiskGauge } from '../components/RiskGauge';

// 使用组件
<RiskGauge 
  type="trading"    // 'trading' 或 'defi'
  height={300}      // 可选，默认300
/>

// 配置项
interface RiskGaugeProps {
  type: 'trading' | 'defi';
  height?: number;
  refreshInterval?: number;     // 刷新间隔，默认60秒
  highRiskThreshold?: number;   // 高风险阈值，默认70
  mediumRiskThreshold?: number; // 中等风险阈值，默认30
}
```

3. VolatilityChart: 波动率图表
```typescript
import { VolatilityChart } from '../components/VolatilityChart';

// 使用组件
<VolatilityChart 
  type="trading"    // 'trading' 或 'defi'
  height={300}      // 可选，默认300
/>

// 配置项
interface VolatilityChartProps {
  type: 'trading' | 'defi';
  height?: number;
  refreshInterval?: number;     // 刷新间隔，默认60秒
  metrics?: ('volatility' | 'sharpeRatio')[];  // 显示指标
  minSharpeRatio?: number;      // 最小夏普比率，默认0.5
}
```

4. PerformanceChart: 性能图表
```typescript
import { PerformanceChart } from '../components/PerformanceChart';

// 使用组件
<PerformanceChart 
  type="trading"    // 'trading' 或 'defi'
  height={300}      // 可选，默认300
/>

// 配置项
interface PerformanceChartProps {
  type: 'trading' | 'defi';
  height?: number;
  refreshInterval?: number;     // 刷新间隔，默认60秒
  showVolume?: boolean;         // 是否显示交易量，默认true
  timeRange?: '24h' | '7d' | '30d';  // 时间范围，默认24h
}
```

#### API接口

1. 性能指标
```typescript
// GET /api/v1/metrics/{type}/performance
interface PerformanceMetrics {
  performance24h: number;       // 24小时收益率
  drawdown: number;            // 当前回撤
  volatility: number;          // 波动率
  sharpeRatio: number;         // 夏普比率
  riskUsage: number;           // 风险使用率
}
```

2. 风险指标
```typescript
// GET /api/v1/metrics/{type}/risk
interface RiskMetrics {
  riskLevel: 'low' | 'medium' | 'high';
  exposureRatio: number;       // 敞口比率
  positionSize: number;        // 仓位大小
  marginUsage: number;         // 保证金使用率
}
```

### Python策略层

1. 策略开发 (src/python/strategies/)
```python
class CustomStrategy:
    def __init__(self):
        self.dex = DEXAggregator()
        self.analyzer = AIAnalyzer()
    
    async def analyze_market(self):
        # 实现市场分析逻辑
        pass
    
    async def execute_trade(self):
        # 实现交易执行逻辑
        pass
```

2. DEX接口 (src/python/dex/)
```python
class CustomDEX:
    def __init__(self):
        self.base_url = "https://api.custom-dex.com"
    
    async def get_price(self, token_pair: str):
        # 实现价格查询
        pass
    
    async def execute_swap(self, params: Dict):
        # 实现交易执行
        pass
```

3. AI分析器 (src/python/analysis/)
```python
class CustomAnalyzer:
    def __init__(self):
        self.model = load_model()
    
    async def analyze(self, data: Dict):
        # 实现分析逻辑
        pass
```

### Go执行层

1. 交易执行器 (src/go/internal/executor/)
```go
type CustomExecutor struct {
    orderManager *OrderManager
    riskManager  *RiskManager
}

func (e *CustomExecutor) ExecuteTrade(ctx context.Context, order *Order) error {
    // 实现交易执行逻辑
    return nil
}
```

2. 风险控制 (src/go/internal/risk/)
```go
type CustomRiskManager struct {
    limits map[string]float64
}

func (r *CustomRiskManager) CheckRisk(order *Order) error {
    // 实现风险检查逻辑
    return nil
}
```

## 添加新功能

### 1. 添加新的DEX

1. 创建DEX接口实现
```python
# src/python/dex/new_dex.py
class NewDEX:
    def __init__(self):
        self.base_url = "https://api.new-dex.com"
        
    async def get_price(self, token_pair: str):
        # 实现价格查询
        pass
```

2. 更新DEX聚合器
```python
# src/python/dex/aggregator.py
class DEXAggregator:
    def __init__(self):
        self.dexes = [
            JupiterDEX(),
            RaydiumDEX(),
            OrcaDEX(),
            NewDEX()  # 添加新DEX
        ]
```

### 2. 添加新的交易策略

1. 创建策略类
```python
# src/python/strategies/new_strategy.py
class NewStrategy:
    def __init__(self):
        self.dex = DEXAggregator()
        self.analyzer = AIAnalyzer()
        
    async def execute(self):
        # 实现策略逻辑
        pass
```

2. 注册策略
```python
# src/python/strategies/__init__.py
STRATEGIES = {
    'default': DefaultStrategy,
    'new': NewStrategy  # 注册新策略
}
```

### 3. 添加新的风险控制规则

1. 创建风险规则
```go
// src/go/internal/risk/new_rule.go
type NewRiskRule struct {
    threshold float64
}

func (r *NewRiskRule) Check(order *Order) error {
    // 实现风险检查逻辑
    return nil
}
```

2. 注册规则
```go
// src/go/internal/risk/manager.go
func NewRiskManager() *RiskManager {
    return &RiskManager{
        rules: []RiskRule{
            NewPositionRule(),
            NewExposureRule(),
            NewRiskRule(),  // 添加新规则
        },
    }
}
```

## 测试

### 1. 单元测试

```bash
# 运行Python测试
cd tests/python
pytest test_dex_strategy.py -v

# 运行Go测试
cd tests/go
go test -v ./...
```

### 2. 集成测试

```bash
# 运行所有测试
./src/scripts/run_tests.sh
```

## 日志和监控

### 1. 日志配置

```python
# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/custom.log'),
        logging.StreamHandler()
    ]
)
```

### 2. 监控指标

```python
# 添加自定义指标
metrics = {
    'trade_count': Counter('trades_total', 'Total number of trades'),
    'trade_volume': Gauge('trade_volume', 'Current trading volume'),
    'success_rate': Histogram('success_rate', 'Trade success rate')
}
```

## 部署

1. 构建
```bash
# 构建Go服务
cd src/go
go build -o ../../bin/tradingbot cmd/main.go

# 打包Python服务
cd src/python
python setup.py sdist
```

2. 配置
```bash
# 复制配置文件
cp config/.env.example config/.env
# 编辑配置
vim config/.env
```

3. 启动
```bash
# 启动所有服务
./src/scripts/start_system.sh
```

## 故障排除

1. 检查日志
```bash
tail -f logs/trading.log
tail -f logs/dex.log
tail -f logs/ai.log
```

2. 验证安装
```bash
./src/scripts/verify_install.sh
```

3. 重置环境
```bash
# 清理并重新初始化
rm -rf venv311
./src/scripts/init_project.sh
