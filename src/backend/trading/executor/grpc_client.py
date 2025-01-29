from typing import Dict, Any, AsyncGenerator
import grpc
import asyncio
from google.protobuf.json_format import MessageToDict
from src.protos import trading_pb2
from src.protos import trading_pb2_grpc

class TradingExecutorClient:
    def __init__(self, address: str = "localhost:50051"):
        self.channel = grpc.aio.insecure_channel(address)
        self.stub = trading_pb2_grpc.TradingExecutorStub(self.channel)
        
    async def execute_trade(self, trade_params: Dict[str, Any]) -> Dict[str, Any]:
        request = trading_pb2.TradeRequest(
            symbol=trade_params["symbol"],
            side=trade_params["side"],
            amount=float(trade_params["amount"]),
            price=float(trade_params.get("price", 0)),
            order_type=trade_params.get("order_type", "MARKET"),
            params=trade_params.get("params", {})
        )
        
        response = await self.stub.ExecuteTrade(request)
        return MessageToDict(response)
    
    async def get_market_data(self, symbol: str, data_type: str = "FULL", depth: int = 10) -> AsyncGenerator[Dict[str, Any], None]:
        request = trading_pb2.MarketDataRequest(
            symbol=symbol,
            data_type=data_type,
            depth=depth
        )
        
        async for data in self.stub.GetMarketData(request):
            yield MessageToDict(data)
    
    async def monitor_order_status(self, order_id: str) -> AsyncGenerator[Dict[str, Any], None]:
        request = trading_pb2.OrderStatusRequest(order_id=order_id)
        
        async for status in self.stub.MonitorOrderStatus(request):
            yield MessageToDict(status)
    
    async def batch_execute_trades(self, trades: list[Dict[str, Any]], atomic: bool = False) -> Dict[str, Any]:
        trade_requests = [
            trading_pb2.TradeRequest(
                symbol=t["symbol"],
                side=t["side"],
                amount=float(t["amount"]),
                price=float(t.get("price", 0)),
                order_type=t.get("order_type", "MARKET"),
                params=t.get("params", {})
            )
            for t in trades
        ]
        
        request = trading_pb2.BatchTradeRequest(
            trades=trade_requests,
            atomic=atomic
        )
        
        response = await self.stub.BatchExecuteTrades(request)
        return MessageToDict(response)
    
    async def close(self):
        await self.channel.close()

class ExecutorPool:
    def __init__(self, addresses: list[str], pool_size: int = 3):
        self.addresses = addresses
        self.pool_size = pool_size
        self.clients: list[TradingExecutorClient] = []
        self.current = 0
        self._lock = asyncio.Lock()
    
    async def initialize(self):
        self.clients = [
            TradingExecutorClient(addr)
            for addr in self.addresses[:self.pool_size]
        ]
    
    async def get_client(self) -> TradingExecutorClient:
        async with self._lock:
            client = self.clients[self.current]
            self.current = (self.current + 1) % len(self.clients)
            return client
    
    async def close(self):
        await asyncio.gather(*(client.close() for client in self.clients))
from concurrent.futures import ThreadPoolExecutor
from typing import List, Optional, Dict, Any
import grpc
import redis
import time
import json

from .grpc_stubs.tradingbot.proto import trade_service_pb2 as pb
from .grpc_stubs.tradingbot.proto import trade_service_pb2_grpc as pb_grpc

class TradeServiceClient:
    def __init__(
        self,
        grpc_host: str = "localhost",
        grpc_port: int = 50051,
        redis_host: str = "localhost",
        redis_port: int = 6379,
        pool_size: int = 10
    ):
        self.channel_pool = []
        self.pool_size = pool_size
        self.target = f"{grpc_host}:{grpc_port}"
        self.redis_client = redis.Redis(host=redis_host, port=redis_port)
        self._initialize_channel_pool()

    def _initialize_channel_pool(self):
        for _ in range(self.pool_size):
            channel = grpc.insecure_channel(
                self.target,
                options=[
                    ('grpc.max_send_message_length', 4 * 1024 * 1024),
                    ('grpc.max_receive_message_length', 4 * 1024 * 1024),
                    ('grpc.keepalive_time_ms', 10000),
                    ('grpc.keepalive_timeout_ms', 5000),
                ]
            )
            stub = pb_grpc.TradeServiceStub(channel)
            stub = pb_grpc.TradeServiceStub(channel)
            self.channel_pool.append(stub)

    def _get_stub(self) -> 'pb_grpc.TradeServiceStub':
        return self.channel_pool[int(time.time() * 1000) % self.pool_size]

    def get_market_data(
        self,
        symbol: str,
        timeframe: str = "1m",
        limit: int = 100,
        use_cache: bool = True
    ) -> List[dict]:
        cache_key = f"market_data:{symbol}:{timeframe}:{limit}"
        
        if use_cache:
            cached_data = self.redis_client.get(cache_key)
            if cached_data:
                try:
                    return eval(cached_data.decode('utf-8'))
                except:
                    pass

        request = pb.MarketDataRequest(
            symbol=symbol,
            timeframe=timeframe,
            limit=limit
        )
        
        response = self._get_stub().GetMarketData(request)
        
        candles = [{
            'open': c.open,
            'high': c.high,
            'low': c.low,
            'close': c.close,
            'volume': c.volume,
            'timestamp': c.timestamp
        } for c in response.candles]

        if use_cache:
            self.redis_client.setex(cache_key, 5, json.dumps(candles))
        
        return candles

    def execute_trade(
        self,
        symbol: str,
        side: str,
        amount: float,
        price: float,
        order_type: str = "market",
        slippage: float = 1.0
    ) -> dict:
        request = pb.TradeRequest(
            symbol=symbol,
            side=side,
            amount=amount,
            price=price,
            order_type=order_type,
            slippage=slippage
        )
        
        response = self._get_stub().ExecuteTrade(request)
        
        return {
            'order_id': response.order_id,
            'status': response.status,
            'executed_price': response.executed_price,
            'executed_amount': response.executed_amount,
            'timestamp': response.timestamp
        }

    def get_order_status(self, order_id: str) -> dict:
        request = pb.OrderStatusRequest(order_id=order_id)
        response = self._get_stub().GetOrderStatus(request)
        
        return {
            'order_id': response.order_id,
            'status': response.status,
            'filled_amount': response.filled_amount,
            'average_price': response.average_price,
            'error_message': response.error_message
        }

    def subscribe_price_updates(
        self,
        symbols: List[str],
        callback,
        update_interval_ms: int = 1000
    ):
        request = pb.PriceSubscriptionRequest(
            symbols=symbols,
            update_interval_ms=update_interval_ms
        )
        
        try:
            for update in self._get_stub().SubscribePriceUpdates(request):
                callback({
                    'symbol': update.symbol,
                    'price': update.price,
                    'volume': update.volume,
                    'timestamp': update.timestamp,
                    'bid': update.bid,
                    'ask': update.ask
                })
        except grpc.RpcError as e:
            if e.code() == grpc.StatusCode.CANCELLED:
                return
            raise e
>>>>>>> origin/main
