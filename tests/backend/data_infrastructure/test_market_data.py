import asyncio
from datetime import datetime

import pytest

from tradingbot.backend.trading_agent.agents.market_data_agent import MarketDataAgent
from tradingbot.shared.models.market_data import MarketData


@pytest.fixture
def market_data_agent():
    """Create MarketDataAgent instance for testing."""
    config = {
        "data_sources": {"coingecko": True},
        "symbols": ["BTC/USDT", "ETH/USDT"],
        "timeframes": ["1h", "4h"],
        "update_interval": 60
    }
    return MarketDataAgent("test_agent", "Market Data Test Agent", config)


@pytest.mark.asyncio
async def test_market_data_flow(market_data_agent):
    """Test market data flow between Python and Go components."""
    await market_data_agent.start()
    
    # Test market data collection
    market_data = await market_data_agent.fetch_market_data("BTC/USDT", "1h")
    assert isinstance(market_data, MarketData)
    assert market_data.symbol == "BTC/USDT"
    assert market_data.price > 0
    assert market_data.volume >= 0
    
    # Test batch market data processing
    test_data = [
        MarketData(
            symbol="BTC/USDT",
            exchange="test",
            timestamp=datetime.now(),
            price=50000.0,
            volume=1000000.0,
            timeframe="1h"
        ),
        MarketData(
            symbol="ETH/USDT",
            exchange="test",
            timestamp=datetime.now(),
            price=3000.0,
            volume=500000.0,
            timeframe="1h"
        )
    ]
    processed_data = await market_data_agent.process_batch_market_data(test_data)
    assert len(processed_data) == 2
    for data in processed_data:
        assert "processed_data" in data
        assert "metadata" in data
        assert data["processed_data"]["price"] > 0
        
    # Test market data streaming
    await market_data_agent.initialize_market_stream("BTC/USDT")
    assert market_data_agent.is_streaming("BTC/USDT")
    
    stream_data = await market_data_agent.process_stream_data(test_data[0])
    assert "real_time_metrics" in stream_data
    assert stream_data["real_time_metrics"]["price"] > 0
    assert stream_data["real_time_metrics"]["volume"] >= 0
    
    # Test market metrics calculation
    metrics = await market_data_agent.calculate_market_metrics("BTC/USDT", "1h")
    assert "volatility" in metrics
    assert "volume_profile" in metrics
    assert "price_momentum" in metrics
    assert all(isinstance(v, float) for v in metrics.values())
    
    # Test cross-market analysis
    market_analysis = await market_data_agent.aggregate_market_metrics(["BTC/USDT", "ETH/USDT"], "1h")
    assert "market_correlation" in market_analysis
    assert "sector_strength" in market_analysis
    assert "composite_score" in market_analysis
    
    # Cleanup
    await market_data_agent.cleanup_market_stream("BTC/USDT")
    assert not market_data_agent.is_streaming("BTC/USDT")
    await market_data_agent.stop()
