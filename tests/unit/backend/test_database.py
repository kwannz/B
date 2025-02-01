import json
from datetime import datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.shared.models.base import Strategy, Trade, User
from src.shared.models.cache import MarketDataCache, SentimentCache
from src.shared.models.database import (
    MARKET_PREFIX,
    SENTIMENT_PREFIX,
    close_db,
    delete_cache,
    get_cache,
    init_db,
    set_cache,
)
from src.shared.models.market_data import MarketData, MarketMetrics, TradingSignal


@pytest.mark.asyncio
async def test_database_connections(db_session: AsyncSession):
    # Test PostgreSQL
    async with db_session.begin():
        user = User(username="test_user", api_key="test_key")
        db_session.add(user)

        result = await db_session.execute(
            select(User).where(User.username == "test_user")
        )
        fetched_user = result.scalar_one()
        assert fetched_user is not None
        assert fetched_user.username == "test_user"

        await db_session.delete(user)

    # Test Redis cache
    market_data = MarketDataCache(
        symbol="BTC/USD",
        price=50000.0,
        volume=100.0,
        timestamp=datetime.utcnow(),
        bid=49990.0,
        ask=50010.0,
    )
    cache_key = f"{MARKET_PREFIX}BTC/USD"
    await set_cache(cache_key, market_data.model_dump_json(), expire=60)
    cached_data = await get_cache(cache_key)
    assert cached_data is not None
    loaded_data = MarketDataCache.model_validate_json(cached_data)
    assert loaded_data.symbol == "BTC/USD"
    await delete_cache(cache_key)

    # Test MongoDB
    from src.shared.models.database import market_data_collection

    market_data_doc = {
        "symbol": "ETH/USD",
        "timestamp": datetime.utcnow(),
        "price": 3000.0,
        "volume": 50.0,
        "trades": [],
    }
    result = await market_data_collection.insert_one(market_data_doc)
    assert result.inserted_id is not None

    fetched = await market_data_collection.find_one({"symbol": "ETH/USD"})
    assert fetched is not None
    assert fetched["price"] == 3000.0

    await market_data_collection.delete_one({"symbol": "ETH/USD"})


@pytest.mark.asyncio
async def test_model_relationships(db_session: AsyncSession):
    async with db_session.begin():
        user = User(username="test_user_2", api_key="test_key_2")
        db_session.add(user)

        strategy = Strategy(
            user=user,
            name="Test Strategy",
            type="momentum",
            parameters={"lookback": 20},
        )
        db_session.add(strategy)

        trade = Trade(
            strategy=strategy,
            symbol="BTC/USD",
            side="buy",
            amount=1.0,
            price=50000.0,
            status="pending",
        )
        db_session.add(trade)

        # Test relationships using eager loading
        result = await db_session.execute(
            select(User)
            .options(selectinload(User.strategies).selectinload(Strategy.trades))
            .where(User.username == "test_user_2")
        )
        loaded_user = result.scalar_one()

        assert len(loaded_user.strategies) == 1
        assert loaded_user.strategies[0].name == "Test Strategy"
        assert len(loaded_user.strategies[0].trades) == 1
        assert loaded_user.strategies[0].trades[0].symbol == "BTC/USD"

        # Cleanup
        await db_session.delete(trade)
        await db_session.delete(strategy)
        await db_session.delete(user)


@pytest.mark.asyncio
async def test_error_handling(db_session: AsyncSession):
    async with db_session.begin():
        user1 = User(username="same_user", api_key="key1")
        db_session.add(user1)

    with pytest.raises(Exception):
        async with db_session.begin():
            user2 = User(username="same_user", api_key="key2")
            db_session.add(user2)

    async with db_session.begin():
        result = await db_session.execute(
            select(User).where(User.username == "same_user")
        )
        user1 = result.scalar_one()
        await db_session.delete(user1)
