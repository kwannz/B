import pytest
from src.shared.risk.risk_manager import RiskManager, RiskConfig
from typing import Dict, Any

@pytest.fixture
def risk_manager():
    return RiskManager()

@pytest.fixture
def meme_token_params():
    return {
        "symbol": "DOGE/USDT",
        "is_meme_coin": True,
        "price": 0.1,
        "volume": 1000000,
        "liquidity": 500000,
        "volatility": 2.0,
        "position_size": 10000,
        "take_profit_levels": [0.15, 0.25, 0.4],
        "stop_loss": 0.08
    }

async def test_adjust_for_meme_coins(risk_manager, meme_token_params):
    adjusted_params = await risk_manager.adjust_for_meme_coins(meme_token_params.copy(), {"is_meme": True})
    
    assert adjusted_params["max_allocation"] == risk_manager.config.MEME_MAX_ALLOCATION
    assert adjusted_params["max_position_size"] == risk_manager.config.MEME_MAX_POSITION_SIZE
    assert adjusted_params["min_liquidity"] == risk_manager.config.MEME_MIN_LIQUIDITY
    assert adjusted_params["max_slippage"] == risk_manager.config.MEME_MAX_SLIPPAGE
    
    expected_position = meme_token_params["position_size"] * (1.0 - risk_manager.config.MEME_VOLATILITY_CUSHION)
    assert adjusted_params["position_size"] == expected_position
    
    expected_levels = [level * risk_manager.config.MEME_TAKE_PROFIT_MULTIPLIER 
                      for level in meme_token_params["take_profit_levels"]]
    assert adjusted_params["take_profit_levels"] == expected_levels
    
    expected_stop = meme_token_params["stop_loss"] * risk_manager.config.MEME_STOP_LOSS_MULTIPLIER
    assert adjusted_params["stop_loss"] == expected_stop

async def test_risk_config_validation():
    config = RiskConfig()
    
    config.validate()  # Should pass with default values
    
    config.MEME_MAX_ALLOCATION = 0.2
    with pytest.raises(ValueError, match="MEME_MAX_ALLOCATION must be between 0 and 0.1"):
        config.validate()
    config.MEME_MAX_ALLOCATION = 0.05
    
    config.MEME_VOLATILITY_CUSHION = 0.1
    with pytest.raises(ValueError, match="MEME_VOLATILITY_CUSHION must be between 0 and 0.05"):
        config.validate()
    config.MEME_VOLATILITY_CUSHION = 0.02
    
    config.MEME_MAX_POSITION_SIZE = config.MAX_POSITION_SIZE + 1000
    with pytest.raises(ValueError, match="MEME_MAX_POSITION_SIZE must be between 0 and MAX_POSITION_SIZE"):
        config.validate()

async def test_calculate_risk_metrics_with_meme_coins(risk_manager, meme_token_params):
    metrics = await risk_manager._calculate_risk_metrics(meme_token_params, meme_token_params["position_size"])
    
    assert metrics["is_valid"]
    assert metrics["position_size"] <= meme_token_params["position_size"]
    assert metrics["risk_level"] > 0.5
    assert len(metrics["recommendations"]) > 0
