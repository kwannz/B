import pytest
from decimal import Decimal
from datetime import datetime
from src.shared.trading.copy_trading import CopyTradingManager
from src.shared.models.trading import TradeType

@pytest.fixture
def config():
    return {
        "min_performance_score": "0.7",
        "max_position_size": "1000.0",
        "risk_multiplier": "0.8"
    }

@pytest.fixture
async def manager(config):
    manager = CopyTradingManager(config)
    await manager.start()
    yield manager
    await manager.stop()

@pytest.fixture
def sample_trade():
    return {
        "type": TradeType.BUY,
        "base_token": "SOL",
        "quote_token": "USDT",
        "size": 100.0,
        "price": 50.0,
        "timestamp": datetime.utcnow().isoformat()
    }

async def test_add_trader(manager):
    address = "trader1"
    await manager.add_trader(address)
    
    assert address in manager.tracked_traders
    assert manager.tracked_traders[address]["performance_score"] == Decimal("0.5")
    assert manager.tracked_traders[address]["total_trades"] == 0

async def test_update_trader_performance(manager):
    address = "trader1"
    await manager.add_trader(address)
    
    await manager.update_trader_performance(address, {"profit": Decimal("100")})
    assert manager.tracked_traders[address]["total_trades"] == 1
    assert manager.tracked_traders[address]["successful_trades"] == 1
    
    await manager.update_trader_performance(address, {"profit": Decimal("-50")})
    assert manager.tracked_traders[address]["total_trades"] == 2
    assert manager.tracked_traders[address]["successful_trades"] == 1

def test_calculate_position_size(manager):
    trader_position = Decimal("1000")
    trader_score = Decimal("0.8")
    
    position_size = manager.calculate_position_size(trader_position, trader_score)
    expected_size = min(
        trader_position * Decimal("0.8") * (trader_score / Decimal("1.0")),
        Decimal("1000.0")
    )
    assert position_size == expected_size

async def test_should_copy_trade(manager, sample_trade):
    address = "trader1"
    await manager.add_trader(address, Decimal("0.8"))
    
    should_copy = await manager.should_copy_trade(address, sample_trade)
    assert should_copy is True
    
    await manager.add_trader("trader2", Decimal("0.6"))
    should_copy = await manager.should_copy_trade("trader2", sample_trade)
    assert should_copy is False

async def test_execute_copy_trade(manager, sample_trade):
    address = "trader1"
    await manager.add_trader(address, Decimal("0.8"))
    
    result = await manager.execute_copy_trade(address, sample_trade)
    assert result is not None
    assert "original_trade" in result
    assert "copied_size" in result
    assert "quote" in result
    assert result["trader"] == address

def test_get_trader_stats(manager):
    address = "trader1"
    manager.tracked_traders[address] = {
        "performance_score": Decimal("0.8"),
        "total_trades": 10,
        "successful_trades": 8,
        "last_trade": {"profit": Decimal("100")}
    }
    
    stats = manager.get_trader_stats(address)
    assert stats["performance_score"] == 0.8
    assert stats["total_trades"] == 10
    assert stats["successful_trades"] == 8
    assert stats["last_trade"] == {"profit": Decimal("100")}
