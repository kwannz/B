import pytest
from datetime import datetime
from typing import Dict, Any
from unittest.mock import patch
from tradingbot.shared.models.errors import TradingError
from tradingbot.backend.trading.executor.base_executor import BaseExecutor

class TestExecutor(BaseExecutor):
    """Concrete implementation of BaseExecutor for testing"""
    async def execute_trade(self, trade_params: Dict[str, Any]) -> Dict[str, Any]:
        return {"trade_id": "test_id", "status": "executed"}
        
    async def cancel_trade(self, trade_id: str) -> bool:
        return True
        
    async def get_trade_status(self, trade_id: str) -> Dict[str, Any]:
        return {"trade_id": trade_id, "status": "completed"}

@pytest.fixture
def valid_config():
    return {
        "strategy_type": "test_strategy",
        "risk_level": "low",
        "trade_size": 1000
    }

@pytest.fixture
def executor(valid_config):
    return TestExecutor(valid_config)

def test_executor_initialization(executor, valid_config):
    """Test executor initialization"""
    assert executor.config == valid_config
    assert executor.status == "inactive"
    assert isinstance(executor.last_update, str)
    
def test_executor_config_validation():
    """Test configuration validation"""
    invalid_configs = [
        {},  # Empty config
        {"strategy_type": "test"},  # Missing fields
        {"risk_level": "low"},      # Missing fields
        {"trade_size": 1000},       # Missing fields
        {                           # Missing one field
            "strategy_type": "test",
            "risk_level": "low"
        }
    ]
    
    for config in invalid_configs:
        with pytest.raises(TradingError) as exc_info:
            TestExecutor(config)
        assert "Missing required config fields" in str(exc_info.value)
        
def test_executor_config_validation_types():
    """Test configuration field type validation"""
    invalid_type_configs = [
        {
            "strategy_type": None,
            "risk_level": "low",
            "trade_size": 1000
        },
        {
            "strategy_type": "test",
            "risk_level": None,
            "trade_size": 1000
        },
        {
            "strategy_type": "test",
            "risk_level": "low",
            "trade_size": None
        },
        {
            "strategy_type": "",  # Empty string
            "risk_level": "low",
            "trade_size": 1000
        },
        {
            "strategy_type": "test",
            "risk_level": "",  # Empty string
            "trade_size": 1000
        },
        {
            "strategy_type": "test",
            "risk_level": "low",
            "trade_size": ""  # Empty string
        }
    ]
    
    for config in invalid_type_configs:
        with pytest.raises((TradingError, ValueError, TypeError)) as exc_info:
            TestExecutor(config)
        assert any(msg in str(exc_info.value) for msg in [
            "Missing required config fields",
            "Invalid value",
            "must be"
        ])

@pytest.mark.asyncio
async def test_executor_lifecycle(executor):
    """Test executor lifecycle"""
    # Initial state
    assert executor.status == "inactive"
    initial_update = executor.last_update
    
    # Start
    result = await executor.start()
    assert result is True
    assert executor.status == "active"
    assert executor.last_update > initial_update
    
    start_update = executor.last_update
    
    # Stop
    result = await executor.stop()
    assert result is True
    assert executor.status == "inactive"
    assert executor.last_update > start_update

@pytest.mark.asyncio
async def test_executor_trade_operations(executor):
    """Test trade execution operations"""
    # Start executor
    await executor.start()
    
    # Execute trade
    trade_params = {"symbol": "BTC/USD", "amount": 100}
    result = await executor.execute_trade(trade_params)
    assert isinstance(result, dict)
    assert "trade_id" in result
    assert "status" in result
    
    # Get trade status
    trade_id = result["trade_id"]
    status = await executor.get_trade_status(trade_id)
    assert isinstance(status, dict)
    assert status["trade_id"] == trade_id
    
    # Cancel trade
    cancel_result = await executor.cancel_trade(trade_id)
    assert isinstance(cancel_result, bool)
    assert cancel_result is True

def test_executor_get_status(executor):
    """Test status retrieval"""
    status = executor.get_status()
    assert isinstance(status, dict)
    assert "status" in status
    assert "last_update" in status
    assert "config" in status
    assert status["status"] == executor.status
    assert status["last_update"] == executor.last_update
    assert status["config"] == executor.config

@pytest.mark.asyncio
async def test_executor_concurrent_operations(executor):
    """Test concurrent trade operations"""
    import asyncio
    
    # Start executor
    await executor.start()
    
    # Create multiple concurrent operations
    async def execute_operation(trade_id: str):
        trade_params = {"symbol": "BTC/USD", "amount": 100, "id": trade_id}
        result = await executor.execute_trade(trade_params)
        status = await executor.get_trade_status(result["trade_id"])
        cancel = await executor.cancel_trade(result["trade_id"])
        return result, status, cancel
    
    # Execute operations concurrently
    tasks = [execute_operation(f"trade_{i}") for i in range(5)]
    results = await asyncio.gather(*tasks)
    
    # Verify results
    for result, status, cancel in results:
        assert isinstance(result, dict)
        assert isinstance(status, dict)
        assert isinstance(cancel, bool)
        assert "trade_id" in result
        assert "status" in status
        assert cancel is True

@pytest.mark.asyncio
async def test_executor_error_handling(executor):
    """Test error handling in trade operations"""
    # Test with invalid trade parameters
    invalid_params = [
        None,
        {},
        {"invalid": "params"},
        {"symbol": None},
        {"amount": None}
    ]
    
    for params in invalid_params:
        try:
            await executor.execute_trade(params)
        except Exception as e:
            assert isinstance(e, (TypeError, ValueError, TradingError))
    
    # Test with invalid trade IDs
    invalid_ids = [None, "", "invalid_id", 123]
    
    for trade_id in invalid_ids:
        try:
            await executor.get_trade_status(trade_id)
            await executor.cancel_trade(trade_id)
        except Exception as e:
            assert isinstance(e, (TypeError, ValueError, TradingError))

@pytest.mark.asyncio
async def test_executor_state_transitions(executor):
    """Test executor state transitions"""
    state_changes = [
        ("start", "active"),
        ("stop", "inactive"),
        ("start", "active"),
        ("start", "active"),  # Double start
        ("stop", "inactive"),
        ("stop", "inactive")  # Double stop
    ]
    
    for operation, expected_status in state_changes:
        if operation == "start":
            await executor.start()
        else:
            await executor.stop()
            
        assert executor.status == expected_status
        status = executor.get_status()
        assert status["status"] == expected_status 