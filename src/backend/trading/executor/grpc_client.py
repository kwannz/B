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
