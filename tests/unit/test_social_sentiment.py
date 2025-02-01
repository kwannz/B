"""Unit tests for social sentiment trading strategy."""

import pytest
from datetime import datetime

from tradingbot.shared.strategies.social_sentiment import SocialSentimentStrategy
from tradingbot.shared.config.tenant_config import StrategyConfig
from tradingbot.models.trading import Trade, TradeStatus, Strategy, StrategyType, Wallet
from tradingbot.models.tenant import Tenant, TenantStatus
from tradingbot.app.db.session import tenant_session
from tradingbot.shared.sentiment.sentiment_analyzer import sentiment_analyzer
from tradingbot.shared.modules.twitter_connector import twitter_connector
from tradingbot.shared.modules.discord_connector import discord_connector


@pytest.fixture
def strategy_config():
    """Create test strategy configuration."""
    return StrategyConfig(
        strategy_type="social_sentiment",
        parameters={
            "sentiment_threshold": 0.6,
            "volume_threshold": 5000,
            "timeframe_hours": 24,
            "min_mentions": 10,
        },
    )


@pytest.fixture
def test_tenant():
    """Create test tenant."""
    with tenant_session() as session:
        tenant = Tenant(
            name="Test Tenant", api_key=f"test_api_key_{datetime.utcnow().isoformat()}"
        )
        session.add(tenant)
        session.commit()
        return tenant


@pytest.fixture
def test_wallet(test_tenant):
    """Create test wallet."""
    with tenant_session() as session:
        wallet = Wallet(
            tenant_id=test_tenant.id,
            address="test_wallet",
            chain="solana",
            balance=1000.0,
            is_active=True,
        )
        session.add(wallet)
        session.commit()
        return wallet


@pytest.fixture
def test_strategy(test_tenant, strategy_config):
    """Create test strategy."""
    with tenant_session() as session:
        strategy = Strategy(
            tenant_id=test_tenant.id,
            name="Test Strategy",
            strategy_type=StrategyType.SOCIAL_SENTIMENT,
            parameters=strategy_config.parameters,
            is_active=True,
        )
        session.add(strategy)
        session.commit()
        return strategy


@pytest.fixture
def mock_market_data():
    """Create mock market data."""
    return [
        {
            "pair": "TEST/USDT",
            "price": 1.0,
            "volume": 10000,
            "timestamp": datetime.utcnow().isoformat(),
        }
    ]


@pytest.fixture
async def mock_twitter_data(monkeypatch):
    """Mock Twitter data."""

    async def mock_search_mentions(*args, **kwargs):
        return [
            {
                "id": "tweet1",
                "text": "Very bullish on $TEST! Great project! 🚀",
                "author_id": "user1",
                "created_at": datetime.utcnow().isoformat(),
            },
            {
                "id": "tweet2",
                "text": "Not sure about $TEST, needs more development...",
                "author_id": "user2",
                "created_at": datetime.utcnow().isoformat(),
            },
        ]

    async def mock_get_metrics(*args, **kwargs):
        return {
            "mention_count": 15,
            "unique_authors": 12,
            "engagement_metrics": {
                "total_likes": 100,
                "total_retweets": 30,
                "total_replies": 20,
            },
        }

    monkeypatch.setattr(
        twitter_connector, "search_recent_mentions", mock_search_mentions
    )
    monkeypatch.setattr(twitter_connector, "get_mention_metrics", mock_get_metrics)


@pytest.fixture
async def mock_discord_data(monkeypatch):
    """Mock Discord data."""

    async def mock_search_mentions(*args, **kwargs):
        return [
            {
                "id": "msg1",
                "content": "TEST token looking strong! 💪",
                "author_id": "user3",
                "created_at": datetime.utcnow().isoformat(),
            },
            {
                "id": "msg2",
                "content": "$TEST price action is concerning...",
                "author_id": "user4",
                "created_at": datetime.utcnow().isoformat(),
            },
        ]

    async def mock_get_metrics(*args, **kwargs):
        return {
            "mention_count": 10,
            "unique_authors": 8,
            "engagement_metrics": {"total_reactions": 50, "total_replies": 15},
        }

    monkeypatch.setattr(
        discord_connector, "search_recent_mentions", mock_search_mentions
    )
    monkeypatch.setattr(discord_connector, "get_mention_metrics", mock_get_metrics)


@pytest.fixture
async def mock_sentiment_analyzer(monkeypatch):
    """Mock sentiment analyzer."""

    async def mock_analyze_token_sentiment(*args, **kwargs):
        return {
            "overall_sentiment": 0.7,
            "overall_confidence": 0.8,
            "total_mentions": 25,
            "sources": {
                "twitter": {
                    "metrics": {
                        "mention_count": 15,
                        "engagement_metrics": {
                            "total_likes": 100,
                            "total_retweets": 30,
                        },
                    },
                    "sentiment": {"avg_sentiment": 0.75, "avg_confidence": 0.85},
                },
                "discord": {
                    "metrics": {
                        "mention_count": 10,
                        "engagement_metrics": {"total_reactions": 50},
                    },
                    "sentiment": {"avg_sentiment": 0.65, "avg_confidence": 0.75},
                },
            },
        }

    monkeypatch.setattr(
        sentiment_analyzer, "analyze_token_sentiment", mock_analyze_token_sentiment
    )


async def test_strategy_initialization(strategy_config):
    """Test strategy initialization."""
    strategy = SocialSentimentStrategy(strategy_config)
    assert strategy.sentiment_threshold == 0.6
    assert strategy.volume_threshold == 5000
    assert strategy.timeframe_hours == 24
    assert strategy.min_mentions == 10


async def test_error_handling(strategy_config, monkeypatch):
    """Test error handling in sentiment analysis."""
    strategy = SocialSentimentStrategy(strategy_config)

    # Test initialization error
    async def mock_init_error():
        raise Exception("Initialization error")

    monkeypatch.setattr(sentiment_analyzer, "initialize", mock_init_error)
    with pytest.raises(Exception, match="Failed to initialize sentiment analyzer"):
        await strategy.initialize()

    # Test with invalid data
    signal = await strategy.calculate_signals([])
    assert signal["signal"] == "neutral"
    assert signal["confidence"] == 0.0

    # Test with missing token symbol
    signal = await strategy.calculate_signals([{"price": 1.0}])
    assert signal["signal"] == "neutral"
    assert "error" in signal

    # Test sentiment analyzer failure
    async def mock_analyze_error(*args, **kwargs):
        raise Exception("Sentiment analysis failed")

    monkeypatch.setattr(
        sentiment_analyzer, "analyze_token_sentiment", mock_analyze_error
    )
    signal = await strategy.calculate_signals([{"pair": "TEST/USDT", "price": 1.0}])
    assert signal["signal"] == "neutral"
    assert "error" in signal
    assert "Sentiment analysis failed" in signal["error"]


async def test_sentiment_analysis(
    strategy_config,
    mock_market_data,
    mock_twitter_data,
    mock_discord_data,
    mock_sentiment_analyzer,
):
    """Test sentiment analysis and signal generation."""
    strategy = SocialSentimentStrategy(strategy_config)

    # Calculate signals
    signal = await strategy.calculate_signals(mock_market_data)

    # Verify signal properties
    assert signal["signal"] == "buy"  # Based on mock sentiment of 0.7
    assert signal["confidence"] > 0.5
    assert "avg_sentiment" in signal
    assert "mention_count" in signal
    assert signal["mention_count"] >= strategy.min_mentions


async def test_insufficient_mentions(
    strategy_config, mock_market_data, mock_sentiment_analyzer, monkeypatch
):
    """Test behavior with insufficient mentions."""

    async def mock_low_mentions(*args, **kwargs):
        result = await mock_sentiment_analyzer.analyze_token_sentiment(*args, **kwargs)
        result["total_mentions"] = 5  # Below minimum
        return result

    monkeypatch.setattr(
        sentiment_analyzer, "analyze_token_sentiment", mock_low_mentions
    )

    strategy = SocialSentimentStrategy(strategy_config)
    signal = await strategy.calculate_signals(mock_market_data)

    assert signal["signal"] == "neutral"
    assert "insufficient_mentions" in signal["reason"]


async def test_insufficient_volume(
    strategy_config, mock_market_data, mock_sentiment_analyzer
):
    """Test behavior with insufficient volume."""
    mock_market_data[0]["volume"] = 1000  # Below threshold

    strategy = SocialSentimentStrategy(strategy_config)
    signal = await strategy.calculate_signals(mock_market_data)

    assert signal["signal"] == "neutral"
    assert "insufficient_volume" in signal["reason"]


async def test_trade_execution(
    strategy_config,
    mock_market_data,
    mock_sentiment_analyzer,
    test_tenant,
    test_wallet,
    test_strategy,
):
    """Test trade execution."""
    strategy = SocialSentimentStrategy(strategy_config)

    # Generate buy signal
    signal = await strategy.calculate_signals(mock_market_data)
    assert signal["signal"] == "buy"

    # Execute trade
    trade = await strategy.execute_trade(
        tenant_id=test_tenant.id,
        wallet=test_wallet,
        market_data={"pair": "TEST/USDT", "price": 1.0, "amount": 1000},
        signal=signal,
    )

    assert trade is not None
    assert trade["status"] == TradeStatus.PENDING
    assert trade["side"] == "buy"
    assert "avg_sentiment" in trade["trade_metadata"]
    assert "mention_count" in trade["trade_metadata"]
    assert trade["trade_metadata"]["avg_sentiment"] > strategy.sentiment_threshold


async def test_position_management(
    strategy_config,
    mock_market_data,
    mock_sentiment_analyzer,
    monkeypatch,
    test_tenant,
    test_wallet,
    test_strategy,
):
    """Test position management with sentiment changes."""
    strategy = SocialSentimentStrategy(strategy_config)

    # First, create a buy position
    signal = await strategy.calculate_signals(mock_market_data)
    trade = await strategy.execute_trade(
        tenant_id=test_tenant.id,
        wallet=test_wallet,
        market_data={"pair": "TEST/USDT", "price": 1.0, "amount": 1000},
        signal=signal,
    )

    # Create test trade in database
    with tenant_session() as session:
        db_trade = Trade(
            tenant_id=test_tenant.id,
            wallet_id=test_wallet.id,
            pair="TEST/USDT",
            side="buy",
            amount=1000.0,
            price=1.0,
            status=TradeStatus.OPEN,
            strategy_id=test_strategy.id,
            trade_metadata=trade["trade_metadata"],
        )
        session.add(db_trade)
        session.commit()

    # Now simulate sentiment reversal
    async def mock_negative_sentiment(*args, **kwargs):
        result = await mock_sentiment_analyzer.analyze_token_sentiment(*args, **kwargs)
        result["overall_sentiment"] = -0.7  # Strong negative sentiment
        return result

    monkeypatch.setattr(
        sentiment_analyzer, "analyze_token_sentiment", mock_negative_sentiment
    )

    # Update positions
    await strategy.update_positions(
        tenant_id=test_tenant.id, market_data=mock_market_data[0]
    )

    # Verify trade was closed due to sentiment reversal
    with tenant_session() as session:
        updated_trade = (
            session.query(Trade)
            .filter_by(
                tenant_id=test_tenant.id,
                strategy_id=test_strategy.id,
                status=TradeStatus.CLOSED,
            )
            .first()
        )
        assert updated_trade is not None
        assert updated_trade.execution_price == float(mock_market_data[0]["price"])
        assert "sentiment_reversal" in str(
            updated_trade.trade_metadata.get("exit_reason", "")
        )


async def test_sentiment_confidence_correlation(
    strategy_config,
    mock_market_data,
    mock_sentiment_analyzer,
    monkeypatch,
    test_tenant,
    test_wallet,
    test_strategy,
):
    """Test correlation between sentiment strength and position size."""
    strategy = SocialSentimentStrategy(strategy_config)

    # Test with different sentiment levels
    sentiment_levels = [0.65, 0.75, 0.85, 0.95]
    position_sizes = []

    for sentiment in sentiment_levels:

        async def mock_sentiment(*args, **kwargs):
            result = await mock_sentiment_analyzer.analyze_token_sentiment(
                *args, **kwargs
            )
            result["overall_sentiment"] = sentiment
            return result

        monkeypatch.setattr(
            sentiment_analyzer, "analyze_token_sentiment", mock_sentiment
        )

        signal = await strategy.calculate_signals(mock_market_data)
        trade = await strategy.execute_trade(
            tenant_id=test_tenant.id,
            wallet=test_wallet,
            market_data={"pair": "TEST/USDT", "price": 1.0, "amount": 1000},
            signal=signal,
        )

        position_sizes.append(trade["amount"])

    # Verify position sizes increase with sentiment strength
    assert all(
        position_sizes[i] <= position_sizes[i + 1]
        for i in range(len(position_sizes) - 1)
    )
