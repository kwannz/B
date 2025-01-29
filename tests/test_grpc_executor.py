import pytest
import asyncio
from unittest.mock import AsyncMock, patch
import pytest
import asyncio
from unittest.mock import AsyncMock, patch
from src.backend.trading.executor.grpc_client import TradingExecutorClient, ExecutorPool
from src.protos import trading_pb2

@pytest.mark.asyncio
async def test_execute_trade():
    client = TradingExecutorClient()
    trade_params = {
        "symbol": "BTC/USD",
        "side": "BUY",
        "amount": 1.0,
        "price": 50000.0,
        "order_type": "LIMIT",
        "params": {"time_in_force": "GTC"}
    }
    
    with patch("src.protos.trading_pb2_grpc.TradingExecutorStub") as mock_stub:
        mock_stub.return_value.ExecuteTrade = AsyncMock()
        mock_stub.return_value.ExecuteTrade.return_value.order_id = "test_order"
        
        result = await client.execute_trade(trade_params)
        assert "orderId" in result
        assert result["orderId"] == "test_order"

@pytest.mark.asyncio
async def test_market_data_stream():
    client = TradingExecutorClient()
    
    mock_data = [
        {"symbol": "BTC/USD", "price": 50000.0, "volume": 100.0},
        {"symbol": "BTC/USD", "price": 50100.0, "volume": 150.0}
    ]
    
    with patch("src.protos.trading_pb2_grpc.TradingExecutorStub") as mock_stub:
        mock_stub.return_value.GetMarketData = AsyncMock()
        mock_stub.return_value.GetMarketData.return_value = mock_data
        
        async for data in client.get_market_data("BTC/USD"):
            assert "symbol" in data
            assert "price" in data
            assert "volume" in data

@pytest.mark.asyncio
async def test_batch_execution():
    client = TradingExecutorClient()
    trades = [
        {
            "symbol": "BTC/USD",
            "side": "BUY",
            "amount": 1.0,
            "price": 50000.0
        },
        {
            "symbol": "ETH/USD",
            "side": "SELL",
            "amount": 10.0,
            "price": 3000.0
        }
    ]
    
    with patch("src.protos.trading_pb2_grpc.TradingExecutorStub") as mock_stub:
        mock_stub.return_value.BatchExecuteTrades = AsyncMock()
        mock_stub.return_value.BatchExecuteTrades.return_value.success = True
        
        result = await client.batch_execute_trades(trades, atomic=True)
        assert result["success"] is True

@pytest.mark.asyncio
async def test_executor_pool():
    addresses = ["localhost:50051", "localhost:50052", "localhost:50053"]
    pool = ExecutorPool(addresses)
    
    await pool.initialize()
    assert len(pool.clients) == 3
    
    client1 = await pool.get_client()
    client2 = await pool.get_client()
    assert client1 != client2
    
    await pool.close()
