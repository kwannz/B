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
