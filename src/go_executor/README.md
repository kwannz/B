# Go交易执行器

高性能的交易执行引擎,负责订单执行、风险控制和性能优化。

## 🚀 快速开始

### 环境要求
- Go 1.21+
- Protocol Buffers
- Make

### 构建和运行
```bash
# 构建
go build -o executor

# 运行
./executor

# 测试
go test ./...
```

## 📁 项目结构

```
go_executor/
├── cmd/              # 命令行入口
├── internal/         # 内部包
│   ├── engine/      # 执行引擎
│   ├── risk/        # 风险控制
│   └── types/       # 类型定义
├── pkg/             # 公共包
│   ├── utils/       # 工具函数
│   └── models/      # 数据模型
└── proto/           # Protocol Buffers
```

## 🔧 核心功能

### 1. 执行引擎 (engine.go)

```go
// 执行引擎接口
type Engine interface {
    Execute(ctx context.Context, order *Order) error
    Cancel(ctx context.Context, orderID string) error
    GetStatus(ctx context.Context, orderID string) (*Status, error)
}

// 执行器实现
type Executor struct {
    orderManager *OrderManager
    riskManager  *RiskManager
    metrics      *Metrics
}

// 执行订单
func (e *Executor) Execute(ctx context.Context, order *Order) error {
    // 风险检查
    if err := e.riskManager.Check(order); err != nil {
        return err
    }
    
    // 执行订单
    return e.orderManager.Execute(order)
}
```

### 2. 风险控制 (risk/manager.go)

```go
// 风险管理器
type RiskManager struct {
    rules []RiskRule
    limits map[string]float64
}

// 风险检查
func (r *RiskManager) Check(order *Order) error {
    for _, rule := range r.rules {
        if err := rule.Validate(order); err != nil {
            return err
        }
    }
    return nil
}
```

### 3. 性能监控 (metrics.go)

```go
// 性能指标
type Metrics struct {
    OrderLatency   prometheus.Histogram
    ExecutionRate  prometheus.Counter
    ErrorRate      prometheus.Counter
}

// 记录延迟
func (m *Metrics) RecordLatency(start time.Time) {
    m.OrderLatency.Observe(time.Since(start).Seconds())
}
```

## 📊 性能优化

### 1. 并发处理
```go
// 并发执行器
type ConcurrentExecutor struct {
    workers int
    queue   chan *Order
}

// 启动工作池
func (e *ConcurrentExecutor) Start(ctx context.Context) {
    for i := 0; i < e.workers; i++ {
        go e.worker(ctx)
    }
}
```

### 2. 内存优化
```go
// 对象池
var orderPool = sync.Pool{
    New: func() interface{} {
        return &Order{}
    },
}

// 获取对象
func GetOrder() *Order {
    return orderPool.Get().(*Order)
}
```

### 3. 性能指标
- 订单延迟 < 1ms
- 吞吐量 > 10000 orders/s
- 错误率 < 0.01%

## 🔒 安全措施

### 1. 风险控制
```go
// 风险规则
type RiskRule interface {
    Validate(order *Order) error
}

// 仓位限制
type PositionRule struct {
    maxPosition float64
}

// 验证规则
func (r *PositionRule) Validate(order *Order) error {
    if order.Size > r.maxPosition {
        return ErrPositionTooLarge
    }
    return nil
}
```

### 2. 错误处理
```go
// 错误定义
var (
    ErrOrderNotFound     = errors.New("order not found")
    ErrInvalidOrder     = errors.New("invalid order")
    ErrRiskLimitExceeded = errors.New("risk limit exceeded")
)

// 错误处理
func handleError(err error) {
    switch err {
    case ErrOrderNotFound:
        // 处理订单未找到
    case ErrInvalidOrder:
        // 处理无效订单
    case ErrRiskLimitExceeded:
        // 处理风险超限
    default:
        // 处理其他错误
    }
}
```

## 🧪 测试

### 单元测试
```bash
# 运行单元测试
go test ./...

# 带覆盖率
go test -cover ./...
```

### 基准测试
```bash
# 运行基准测试
go test -bench=. ./...

# 性能分析
go test -bench=. -cpuprofile=cpu.prof
```

### 集成测试
```bash
# 运行集成测试
go test -tags=integration ./...
```

## 📝 API文档

### 1. gRPC接口
```protobuf
// 交易服务
service TradingService {
    rpc ExecuteOrder(Order) returns (OrderResult);
    rpc CancelOrder(CancelRequest) returns (CancelResult);
    rpc GetOrderStatus(StatusRequest) returns (OrderStatus);
}
```

### 2. REST接口
```go
// HTTP处理器
func (s *Server) handleExecute(w http.ResponseWriter, r *http.Request) {
    // 解析请求
    order := &Order{}
    if err := json.NewDecoder(r.Body).Decode(order); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }
    
    // 执行订单
    result, err := s.engine.Execute(r.Context(), order)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    
    // 返回结果
    json.NewEncoder(w).Encode(result)
}
```

## 🔧 配置

### 1. 执行器配置
```go
type Config struct {
    Workers     int     `json:"workers"`
    QueueSize   int     `json:"queue_size"`
    MaxPosition float64 `json:"max_position"`
    Timeout     string  `json:"timeout"`
}
```

### 2. 风险配置
```go
type RiskConfig struct {
    MaxOrderSize   float64 `json:"max_order_size"`
    MaxPosition    float64 `json:"max_position"`
    MaxDrawdown    float64 `json:"max_drawdown"`
    MinMargin      float64 `json:"min_margin"`
}
```

## 🔍 监控

### 1. 指标收集
```go
// 注册Prometheus指标
func registerMetrics() *Metrics {
    return &Metrics{
        OrderLatency: prometheus.NewHistogram(prometheus.HistogramOpts{
            Name: "order_latency_seconds",
            Help: "Order execution latency in seconds",
            Buckets: prometheus.DefBuckets,
        }),
        // ... 其他指标
    }
}
```

### 2. 健康检查
```go
// 健康检查处理器
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
    if s.engine.IsHealthy() {
        w.WriteHeader(http.StatusOK)
        return
    }
    w.WriteHeader(http.StatusServiceUnavailable)
}
```

## 🐛 故障排除

### 1. 日志
```go
// 初始化日志
func initLogger() *zap.Logger {
    config := zap.NewProductionConfig()
    logger, _ := config.Build()
    return logger
}
```

### 2. 诊断
```go
// 诊断信息
func (e *Executor) Diagnose() *DiagnosticInfo {
    return &DiagnosticInfo{
        Goroutines: runtime.NumGoroutine(),
        MemStats:   &runtime.MemStats{},
        QueueSize:  len(e.queue),
    }
}
