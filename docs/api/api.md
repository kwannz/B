# API文档

## RESTful API

### 基础URL
```
http://localhost:8080/api/v1
```

### 市场数据

#### 获取价格
```http
GET /market/price/{symbol}
```

参数：
- `symbol`: 交易对符号（例如：SOL/USDC）

响应：
```json
{
    "symbol": "SOL/USDC",
    "price": 100.0,
    "time": 1645084800
}
```

#### 获取深度数据
```http
GET /market/depth/{symbol}
```

参数：
- `symbol`: 交易对符号

响应：
```json
{
    "symbol": "SOL/USDC",
    "bids": [
        [100.0, 1.0],
        [99.0, 2.0]
    ],
    "asks": [
        [101.0, 1.0],
        [102.0, 2.0]
    ],
    "time": 1645084800
}
```

### 订单管理

#### 创建订单
```http
POST /orders
```

请求体：
```json
{
    "symbol": "SOL/USDC",
    "side": "buy",
    "price": 100.0,
    "amount": 1.0
}
```

响应：
```json
{
    "order_id": "order123",
    "status": "created",
    "time": 1645084800
}
```

#### 获取订单
```http
GET /orders/{id}
```

参数：
- `id`: 订单ID

响应：
```json
{
    "order_id": "order123",
    "status": "filled",
    "time": 1645084800
}
```

#### 获取所有订单
```http
GET /orders
```

响应：
```json
{
    "orders": [
        {
            "order_id": "order123",
            "status": "filled",
            "time": 1645084800
        }
    ]
}
```

#### 取消订单
```http
DELETE /orders/{id}
```

参数：
- `id`: 订单ID

响应：
```json
{
    "order_id": "order123",
    "status": "cancelled",
    "time": 1645084800
}
```

### 系统状态

#### 获取状态
```http
GET /status
```

响应：
```json
{
    "status": "running",
    "uptime": 1645084800,
    "version": "1.0.0",
    "node_info": {
        "cpu_usage": 0.5,
        "memory_usage": 0.3,
        "connections": 100
    }
}
```

## gRPC服务

### 服务定义
```protobuf
service TradeService {
    rpc GetMarketData(MarketDataRequest) returns (MarketDataResponse) {}
    rpc ExecuteTrade(TradeRequest) returns (TradeResponse) {}
    rpc GetOrderStatus(OrderStatusRequest) returns (OrderStatusResponse) {}
    rpc SubscribePriceUpdates(PriceSubscriptionRequest) returns (stream PriceUpdate) {}
}
```

### 市场数据请求
```protobuf
message MarketDataRequest {
    string symbol = 1;
    string timeframe = 2;
    int32 limit = 3;
}
```

### 市场数据响应
```protobuf
message MarketDataResponse {
    repeated Candle candles = 1;
    double current_price = 2;
    double volume_24h = 3;
    string timestamp = 4;
}
```

### 交易请求
```protobuf
message TradeRequest {
    string symbol = 1;
    string side = 2;
    double amount = 3;
    double price = 4;
    string order_type = 5;
    double slippage = 6;
}
```

### 交易响应
```protobuf
message TradeResponse {
    string order_id = 1;
    string status = 2;
    double executed_price = 3;
    double executed_amount = 4;
    string timestamp = 5;
    string error_message = 6;
}
```

### 价格订阅
```protobuf
message PriceSubscriptionRequest {
    repeated string symbols = 1;
    int32 update_interval_ms = 2;
}
```

### 价格更新
```protobuf
message PriceUpdate {
    string symbol = 1;
    double price = 2;
    string timestamp = 3;
    double change_24h = 4;
    double volume_24h = 5;
}
```

## 使用示例

### Python客户端

```python
import grpc
from trading_pb2 import MarketDataRequest
from trading_pb2_grpc import TradeServiceStub

async def get_market_data():
    channel = grpc.aio.insecure_channel('localhost:50051')
    stub = TradeServiceStub(channel)
    
    request = MarketDataRequest(
        symbol="SOL/USDC",
        timeframe="1m",
        limit=100
    )
    
    response = await stub.GetMarketData(request)
    return response

async def subscribe_prices():
    channel = grpc.aio.insecure_channel('localhost:50051')
    stub = TradeServiceStub(channel)
    
    request = PriceSubscriptionRequest(
        symbols=["SOL/USDC"],
        update_interval_ms=1000
    )
    
    async for update in stub.SubscribePriceUpdates(request):
        print(f"Price update: {update.symbol} = {update.price}")
```

### Go客户端

```go
package main

import (
    "context"
    "log"
    "time"
    
    "google.golang.org/grpc"
    pb "tradingbot/proto"
)

func getMarketData() (*pb.MarketDataResponse, error) {
    conn, err := grpc.Dial("localhost:50051", grpc.WithInsecure())
    if err != nil {
        return nil, err
    }
    defer conn.Close()
    
    client := pb.NewTradeServiceClient(conn)
    ctx, cancel := context.WithTimeout(context.Background(), time.Second)
    defer cancel()
    
    request := &pb.MarketDataRequest{
        Symbol:    "SOL/USDC",
        Timeframe: "1m",
        Limit:     100,
    }
    
    return client.GetMarketData(ctx, request)
}

func subscribePrices() error {
    conn, err := grpc.Dial("localhost:50051", grpc.WithInsecure())
    if err != nil {
        return err
    }
    defer conn.Close()
    
    client := pb.NewTradeServiceClient(conn)
    ctx := context.Background()
    
    request := &pb.PriceSubscriptionRequest{
        Symbols:         []string{"SOL/USDC"},
        UpdateIntervalMs: 1000,
    }
    
    stream, err := client.SubscribePriceUpdates(ctx, request)
    if err != nil {
        return err
    }
    
    for {
        update, err := stream.Recv()
        if err != nil {
            return err
        }
        log.Printf("Price update: %s = %f", update.Symbol, update.Price)
    }
}
