import pytest
from decimal import Decimal
from src.shared.trading.capital_rotation import CapitalRotationManager

@pytest.fixture
def rotation_config():
    return {
        "small_cap_threshold": "30000",
        "rotation_threshold": "0.05",
        "min_profit_threshold": "0.20"
    }

@pytest.fixture
async def rotation_manager(rotation_config):
    manager = CapitalRotationManager(rotation_config)
    await manager.start()
    yield manager
    await manager.stop()

@pytest.fixture
def sample_positions():
    return [
        {
            "token_address": "token1",
            "size": 1000,
            "value": 1500,
            "market_cap": 25000,
            "unrealized_profit_pct": "0.25"
        },
        {
            "token_address": "token2",
            "size": 2000,
            "value": 2200,
            "market_cap": 35000,
            "unrealized_profit_pct": "0.15"
        }
    ]

async def test_calculate_portfolio_metrics(rotation_manager, sample_positions):
    metrics = await rotation_manager.calculate_portfolio_metrics(sample_positions)
    
    assert isinstance(metrics["total_value"], Decimal)
    assert isinstance(metrics["small_cap_value"], Decimal)
    assert isinstance(metrics["small_cap_ratio"], Decimal)
    
    assert metrics["total_value"] == Decimal("3700")
    assert metrics["small_cap_value"] == Decimal("1500")
    assert metrics["small_cap_ratio"] == Decimal("1500") / Decimal("3700")

async def test_should_rotate_capital(rotation_manager, sample_positions):
    should_rotate = await rotation_manager.should_rotate_capital(sample_positions)
    assert isinstance(should_rotate, bool)
    
    metrics = await rotation_manager.calculate_portfolio_metrics(sample_positions)
    should_rotate_with_metrics = await rotation_manager.should_rotate_capital(
        sample_positions, metrics
    )
    assert should_rotate == should_rotate_with_metrics

async def test_get_rotation_candidates(rotation_manager, sample_positions):
    target_token = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    candidates = await rotation_manager.get_rotation_candidates(sample_positions, target_token)
    
    assert isinstance(candidates, list)
    for candidate in candidates:
        assert "position" in candidate
        assert "quote" in candidate
        assert "profit" in candidate
        assert isinstance(candidate["profit"], Decimal)

async def test_execute_rotation(rotation_manager, sample_positions):
    target_token = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    trades = await rotation_manager.execute_rotation(sample_positions, target_token)
    
    assert isinstance(trades, list)
    for trade in trades:
        assert "token_address" in trade
        assert "target_token" in trade
        assert "amount" in trade
        assert "type" in trade
        assert "quote" in trade
