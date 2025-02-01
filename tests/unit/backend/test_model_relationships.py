import pytest
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from src.shared.models.base import User, Strategy, Trade
from src.shared.models.market_data import MarketData, MarketMetrics
from src.shared.models.cache import MarketDataCache, OrderBookCache, TradeHistoryCache

@pytest.mark.asyncio
async def test_user_strategy_trade_relationship(db_session: AsyncSession):
    """Test relationships between User, Strategy, and Trade models."""
    async with db_session.begin():
        # Create test user
        user = User(username="test_trader", api_key="test_key_123")
        db_session.add(user)
        
        # Create strategy for user
        strategy = Strategy(
            user=user,
            name="Momentum Strategy",
            type="momentum",
            parameters={"lookback": 20, "threshold": 0.05}
        )
        db_session.add(strategy)
        
        # Create trades for strategy
        trades = [
            Trade(
                strategy=strategy,
                symbol="BTC/USD",
                side="buy",
                amount=1.0,
                price=50000.0,
                status="executed",
                metadata={"execution_time": 0.05}
            ),
            Trade(
                strategy=strategy,
                symbol="ETH/USD",
                side="sell",
                amount=2.0,
                price=3000.0,
                status="executed",
                metadata={"execution_time": 0.03}
            )
        ]
        for trade in trades:
            db_session.add(trade)
    
    # Verify relationships using eager loading
    async with db_session.begin():
        result = await db_session.execute(
            select(User)
            .options(selectinload(User.strategies).selectinload(Strategy.trades))
            .where(User.username == "test_trader")
        )
        loaded_user = result.scalar_one()
        
        assert loaded_user.username == "test_trader"
        assert len(loaded_user.strategies) == 1
        assert loaded_user.strategies[0].name == "Momentum Strategy"
        assert len(loaded_user.strategies[0].trades) == 2
        assert any(trade.symbol == "BTC/USD" for trade in loaded_user.strategies[0].trades)
        assert any(trade.symbol == "ETH/USD" for trade in loaded_user.strategies[0].trades)

@pytest.mark.asyncio
async def test_market_data_relationships(db_session: AsyncSession):
    """Test market data and metrics relationships."""
    # Create market data
    market_data = {
        "symbol": "BTC/USD",
        "timestamp": datetime.utcnow(),
        "price": 50000.0,
        "volume": 100.0,
        "trades": []
    }
    
    metrics = {
        "symbol": "BTC/USD",
        "timestamp": datetime.utcnow(),
        "volatility": 0.02,
        "volume_profile": {"hour": 1000.0},
        "liquidity_score": 0.8,
        "momentum_indicators": {"rsi": 65},
        "technical_indicators": {"macd": {"signal": 1.2}},
        "metadata": {"source": "binance"}
    }
    
    # Store in MongoDB
    from src.shared.models.database import market_data_collection, market_metrics_collection
    await market_data_collection.insert_one(market_data)
    await market_metrics_collection.insert_one(metrics)
    
    # Verify data storage
    stored_data = await market_data_collection.find_one({"symbol": "BTC/USD"})
    stored_metrics = await market_metrics_collection.find_one({"symbol": "BTC/USD"})
    
    assert stored_data is not None
    assert stored_data["price"] == 50000.0
    assert stored_metrics is not None
    assert stored_metrics["volatility"] == 0.02
    
    # Clean up test data
    await market_data_collection.delete_one({"symbol": "BTC/USD"})
    await market_metrics_collection.delete_one({"symbol": "BTC/USD"})

@pytest.mark.asyncio
async def test_cache_operations():
    """Test Redis cache operations with market data."""
    from src.shared.models.database import set_cache, get_cache, delete_cache
    
    # Test market data cache
    market_data = MarketDataCache(
        symbol="BTC/USD",
        price=50000.0,
        volume=100.0,
        timestamp=datetime.utcnow(),
        bid=49990.0,
        ask=50010.0
    )
    
    cache_key = "market:BTC/USD"
    await set_cache(cache_key, market_data.model_dump_json(), expire=60)
    
    cached_data = await get_cache(cache_key)
    assert cached_data is not None
    loaded_data = MarketDataCache.model_validate_json(cached_data)
    assert loaded_data.symbol == "BTC/USD"
    assert loaded_data.price == 50000.0
    
    # Clean up
    await delete_cache(cache_key)
    assert await get_cache(cache_key) is None
