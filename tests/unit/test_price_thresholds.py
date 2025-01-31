import pytest
from decimal import Decimal
from src.shared.config.price_thresholds import PriceThresholds

@pytest.fixture
def config():
    return {
        "low_threshold": "1.2",
        "high_threshold": "2.0",
        "stop_loss": "0.9",
        "take_profit": "1.5",
        "meme_multiplier": "1.1"
    }

def test_initialization(config):
    thresholds = PriceThresholds(config)
    assert thresholds.low_threshold == Decimal("1.2")
    assert thresholds.high_threshold == Decimal("2.0")
    assert thresholds.stop_loss == Decimal("0.9")
    assert thresholds.take_profit == Decimal("1.5")
    assert thresholds.meme_multiplier == Decimal("1.1")

def test_validation():
    with pytest.raises(ValueError):
        PriceThresholds({"low_threshold": "0"})
    with pytest.raises(ValueError):
        PriceThresholds({"low_threshold": "2.0", "high_threshold": "1.5"})
    with pytest.raises(ValueError):
        PriceThresholds({"stop_loss": "1.1"})
    with pytest.raises(ValueError):
        PriceThresholds({"take_profit": "0.9"})
    with pytest.raises(ValueError):
        PriceThresholds({"meme_multiplier": "0"})

def test_get_thresholds(config):
    thresholds = PriceThresholds(config)
    
    regular = thresholds.get_thresholds(is_meme=False)
    assert regular["low"] == 1.2
    assert regular["high"] == 2.0
    assert regular["stop_loss"] == 0.9
    assert regular["take_profit"] == 1.5
    
    meme = thresholds.get_thresholds(is_meme=True)
    assert meme["low"] == 1.32
    assert meme["high"] == 2.2
    assert meme["stop_loss"] == 0.9
    assert meme["take_profit"] == 1.65

def test_environment_variables(monkeypatch):
    monkeypatch.setenv("PRICE_THRESHOLD_LOW", "1.3")
    monkeypatch.setenv("PRICE_THRESHOLD_HIGH", "2.1")
    monkeypatch.setenv("PRICE_STOP_LOSS", "0.85")
    monkeypatch.setenv("PRICE_TAKE_PROFIT", "1.6")
    monkeypatch.setenv("PRICE_MEME_MULTIPLIER", "1.2")
    
    thresholds = PriceThresholds()
    assert thresholds.low_threshold == Decimal("1.3")
    assert thresholds.high_threshold == Decimal("2.1")
    assert thresholds.stop_loss == Decimal("0.85")
    assert thresholds.take_profit == Decimal("1.6")
    assert thresholds.meme_multiplier == Decimal("1.2")
