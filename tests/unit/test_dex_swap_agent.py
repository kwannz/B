from datetime import datetime, timedelta
from decimal import Decimal

import pandas as pd
import pytest

from src.backend.trading_agent.agents.dex_swap_agent import DexSwapAgent
from src.shared.models.trading import TradeType


@pytest.fixture
def config():
    return {
        "rsi_period": 14,
        "rsi_overbought": "70",
        "rsi_oversold": "30",
        "ma_fast": 10,
        "ma_slow": 20,
        "min_volume": "1000",
        "position_size": "100",
    }


@pytest.fixture
async def agent(config):
    agent = DexSwapAgent(config)
    await agent.start()
    yield agent
    await agent.stop()


@pytest.fixture
def market_data():
    return {
        "token": "TEST",
        "price": "100.0",
        "volume": "5000.0",
        "timestamp": datetime.utcnow().isoformat(),
    }


def generate_price_series(base_price: float = 100.0, periods: int = 30) -> pd.Series:
    timestamps = [
        datetime.utcnow() - timedelta(minutes=i) for i in range(periods - 1, -1, -1)
    ]
    prices = [base_price * (1 + 0.001 * i) for i in range(periods)]
    return pd.Series(prices, index=timestamps)


async def test_calculate_indicators(agent):
    prices = generate_price_series()
    indicators = agent.calculate_indicators(prices)

    assert "rsi" in indicators
    assert "ma_fast" in indicators
    assert "ma_slow" in indicators
    assert "ma_cross" in indicators
    assert all(v is not None for v in indicators.values())


def test_update_price_data(agent):
    token = "TEST"
    price = Decimal("100.0")
    timestamp = datetime.utcnow()

    agent.update_price_data(token, price, timestamp)
    assert token in agent.price_data
    assert len(agent.price_data[token]) == 1
    assert agent.price_data[token][timestamp] == float(price)


async def test_get_trade_signal(agent, market_data):
    token = market_data["token"]
    prices = generate_price_series()

    for timestamp, price in prices.items():
        agent.update_price_data(token, Decimal(str(price)), timestamp)

    signal = await agent.get_trade_signal(token, market_data)
    assert signal is None or isinstance(signal, dict)

    if signal:
        assert "type" in signal
        assert signal["type"] in [TradeType.BUY, TradeType.SELL]
        assert "indicators" in signal
        assert all(k in signal["indicators"] for k in ["rsi", "ma_fast", "ma_slow"])


async def test_execute_strategy(agent, market_data):
    token = market_data["token"]
    prices = generate_price_series()

    for timestamp, price in prices.items():
        agent.update_price_data(token, Decimal(str(price)), timestamp)

    result = await agent.execute_strategy(market_data)
    assert result is None or isinstance(result, dict)

    if result:
        assert "signal" in result
        assert "quote" in result
        assert "position_size" in result
        assert isinstance(result["position_size"], float)


async def test_invalid_market_data(agent):
    invalid_data = {
        "token": "TEST",
        "price": "0",
        "volume": "0",
        "timestamp": datetime.utcnow().isoformat(),
    }

    signal = await agent.get_trade_signal("TEST", invalid_data)
    assert signal is None

    result = await agent.execute_strategy(invalid_data)
    assert result is None
