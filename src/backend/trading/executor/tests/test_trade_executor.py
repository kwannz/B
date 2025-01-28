import pytest
from datetime import datetime
from typing import Dict, Any
from ...executor.trade_executor import TradeExecutor
from ...executor.base_executor import BaseExecutor

@pytest.fixture
def trade_config() -> Dict[str, Any]:
    return {
        "strategy_type": "momentum",
        "risk_level": "medium",
        "trade_size": 0.1
    }

@pytest.fixture
def executor(trade_config):
    return TradeExecutor(trade_config)

@pytest.mark.asyncio
async def test_executor_initialization(executor, trade_config):
    assert isinstance(executor, BaseExecutor)
    assert executor.config == trade_config
    assert executor.status == "inactive"
    assert isinstance(executor.active_trades, dict)
    assert isinstance(executor.trade_history, list)

@pytest.mark.asyncio
async def test_execute_trade(executor):
    trade_params = {
        "symbol": "SOL/USDC",
        "type": "buy",
        "price": 100.0,
        "size": 0.1
    }
    
    trade = await executor.execute_trade(trade_params)
    assert trade["status"] == "pending"
    assert trade["params"] == trade_params
    assert "id" in trade
    assert "timestamp" in trade
    assert trade["id"] in executor.active_trades

@pytest.mark.asyncio
async def test_cancel_trade(executor):
    trade_params = {
        "symbol": "SOL/USDC",
        "type": "buy",
        "price": 100.0,
        "size": 0.1
    }
    
    trade = await executor.execute_trade(trade_params)
    trade_id = trade["id"]
    
    assert await executor.cancel_trade(trade_id)
    assert trade_id not in executor.active_trades
    cancelled_trade = next(t for t in executor.trade_history if t["id"] == trade_id)
    assert cancelled_trade["status"] == "cancelled"

@pytest.mark.asyncio
async def test_get_trade_status(executor):
    trade_params = {
        "symbol": "SOL/USDC",
        "type": "buy",
        "price": 100.0,
        "size": 0.1
    }
    
    trade = await executor.execute_trade(trade_params)
    trade_id = trade["id"]
    
    status = await executor.get_trade_status(trade_id)
    assert status == trade
    
    await executor.cancel_trade(trade_id)
    status = await executor.get_trade_status(trade_id)
    assert status["status"] == "cancelled"

@pytest.mark.asyncio
async def test_start_stop(executor):
    assert await executor.start()
    assert executor.status == "active"
    
    assert await executor.stop()
    assert executor.status == "inactive"
    assert len(executor.active_trades) == 0
