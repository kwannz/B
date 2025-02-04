import time
from datetime import datetime, timedelta

import pytest

from src.shared.models.cache import CacheConfig, MarketDataCache, RateLimitCache
from src.shared.models.database import delete_cache, get_cache, set_cache
from src.shared.risk.risk_manager import RiskAssessment, RiskConfig, RiskManager
from src.shared.risk.trade_factory import create_trade_dict


@pytest.fixture
def risk_manager():
    return RiskManager()


@pytest.mark.asyncio
async def test_basic_validation(risk_manager):
    # Test invalid parameters
    invalid_trade = create_trade_dict(amount=-1)
    assessment = await risk_manager.assess_trade(invalid_trade)
    assert not assessment.is_valid
    assert "Invalid trade parameters" in assessment.reason
    assert assessment.take_profit_levels is None
    assert assessment.trailing_stop_level is None
    assert assessment.dynamic_position_size is None

    # Test valid parameters
    valid_trade = create_trade_dict(
        volatility=0.8,
        liquidity=1000000,
        volume=10000,
        stop_loss=49000,
        take_profit=52000,
        leverage=2,
    )
    assessment = await risk_manager.assess_trade(valid_trade)
    assert assessment.is_valid
    assert assessment.confidence >= 0.8
    assert len(assessment.take_profit_levels) == 3
    assert assessment.trailing_stop_level is not None
    assert assessment.dynamic_position_size is not None


@pytest.mark.asyncio
async def test_position_sizing(risk_manager):
    trade = create_trade_dict(
        symbol="ETH/USD", amount=10, price=3000, stop_loss_pct=0.02, leverage=1
    )
    assessment = await risk_manager.assess_trade(trade)
    assert assessment.is_valid
    assert assessment.position_size <= 10000  # Max position size limit


@pytest.mark.asyncio
async def test_risk_metrics(risk_manager):
    trade = create_trade_dict(volatility=0.5, stop_loss=49000, take_profit=53000)
    assessment = await risk_manager.assess_trade(trade)
    assert assessment.is_valid
    assert assessment.risk_reward_ratio >= 2.0
    assert assessment.market_conditions_alignment >= 0.7
    assert len(assessment.take_profit_levels) == 3
    assert assessment.trailing_stop_level > trade["price"]
    assert (
        assessment.dynamic_position_size == trade["amount"]
    )  # No reduction for low volatility


@pytest.mark.asyncio
async def test_market_conditions(risk_manager):
    # Test poor market conditions
    poor_conditions = create_trade_dict(
        liquidity=50000,  # Below minimum
        volatility=2.5,  # Too high
        spread=0.03,  # Too wide
        volume=1000,
    )
    assessment = await risk_manager.assess_trade(poor_conditions)
    assert not assessment.is_valid
    assert "market conditions" in assessment.reason.lower()
    assert assessment.take_profit_levels is None
    assert assessment.trailing_stop_level is None
    assert assessment.dynamic_position_size is None

    # Test good market conditions
    good_conditions = create_trade_dict(
        liquidity=1000000, volatility=0.8, spread=0.001, volume=10000
    )
    assessment = await risk_manager.assess_trade(good_conditions)
    assert assessment.is_valid
    assert assessment.market_conditions_alignment >= 0.8
    assert len(assessment.take_profit_levels) == 3
    assert assessment.trailing_stop_level > good_conditions["price"]
    assert assessment.dynamic_position_size <= good_conditions["amount"]


@pytest.mark.asyncio
async def test_recommendations(risk_manager):
    trade = create_trade_dict(
        stop_loss=49500,
        take_profit=51000,  # Small profit target
        volatility=1.8,  # High volatility
        liquidity=1000000,
        spread=0.001,
        volume=10000,
    )
    assessment = await risk_manager.assess_trade(trade)
    assert assessment.is_valid
    assert len(assessment.recommendations) > 0
    assert any("risk-reward" in rec.lower() for rec in assessment.recommendations)
    assert any("volatility" in rec.lower() for rec in assessment.recommendations)
    assert any(
        "multiple take-profit levels" in rec.lower()
        for rec in assessment.recommendations
    )
    assert assessment.dynamic_position_size < trade["amount"]
    assert len(assessment.take_profit_levels) == 3
    assert assessment.trailing_stop_level > trade["price"]


@pytest.mark.asyncio
async def test_error_handling(risk_manager):
    # Test with missing required fields
    invalid_trade = create_trade_dict()
    del invalid_trade["amount"]
    del invalid_trade["price"]
    assessment = await risk_manager.assess_trade(invalid_trade)
    assert not assessment.is_valid
    assert assessment.confidence > 0.9
    assert "Invalid trade parameters" in assessment.reason
    assert assessment.take_profit_levels is None
    assert assessment.trailing_stop_level is None
    assert assessment.dynamic_position_size is None

    # Test with invalid types
    with pytest.raises(ValueError):
        create_trade_dict(amount="invalid")

    # Test with invalid values
    with pytest.raises(ValueError, match="Amount and price cannot be None"):
        create_trade_dict(amount=None)

    # Test with zero values
    assessment = await risk_manager.assess_trade(create_trade_dict(amount=0))
    assert not assessment.is_valid
    assert "Invalid trade parameters" in assessment.reason
    assert assessment.take_profit_levels is None
    assert assessment.trailing_stop_level is None
    assert assessment.dynamic_position_size is None


@pytest.mark.asyncio
async def test_config_validation():
    config = RiskConfig()

    # Test valid config
    config.validate()  # Should not raise

    # Test invalid confidence
    original = config.MIN_CONFIDENCE
    config.MIN_CONFIDENCE = 1.5
    with pytest.raises(ValueError, match="MIN_CONFIDENCE must be between 0 and 1"):
        config.validate()
    config.MIN_CONFIDENCE = original

    # Test invalid risk per trade
    original = config.RISK_PER_TRADE
    config.RISK_PER_TRADE = 0.15
    with pytest.raises(ValueError, match="RISK_PER_TRADE must be between 0 and 0.1"):
        config.validate()
    config.RISK_PER_TRADE = original

    # Test invalid take profit levels
    original = config.DYNAMIC_TAKE_PROFIT_LEVELS
    config.DYNAMIC_TAKE_PROFIT_LEVELS = [0.5, 0.3, 1.0]  # Not ascending
    with pytest.raises(
        ValueError, match="DYNAMIC_TAKE_PROFIT_LEVELS must be in ascending order"
    ):
        config.validate()
    config.DYNAMIC_TAKE_PROFIT_LEVELS = original

    # Test invalid leverage
    original = config.MAX_LEVERAGE
    config.MAX_LEVERAGE = 25
    with pytest.raises(ValueError, match="MAX_LEVERAGE must be between 1 and 20"):
        config.validate()
    config.MAX_LEVERAGE = original

    # Test invalid slippage
    original = config.MAX_SLIPPAGE
    config.MAX_SLIPPAGE = 0.1
    with pytest.raises(ValueError, match="MAX_SLIPPAGE must be between 0 and 0.05"):
        config.validate()
    config.MAX_SLIPPAGE = original

    # Test invalid position reduction rate
    original = config.POSITION_REDUCTION_RATE
    config.POSITION_REDUCTION_RATE = 1.5
    with pytest.raises(
        ValueError, match="POSITION_REDUCTION_RATE must be between 0 and 1"
    ):
        config.validate()
    config.POSITION_REDUCTION_RATE = original

    # Test invalid trailing stop activation
    original = config.TRAILING_STOP_ACTIVATION
    config.TRAILING_STOP_ACTIVATION = 4.0
    with pytest.raises(
        ValueError, match="TRAILING_STOP_ACTIVATION must be between 0 and 3"
    ):
        config.validate()
    config.TRAILING_STOP_ACTIVATION = original


@pytest.mark.asyncio
async def test_high_volatility(risk_manager):
    trade = create_trade_dict(
        amount=2, volatility=2.2, liquidity=1000000, volume=10000  # High volatility
    )

    assessment = await risk_manager.assess_trade(trade)
    assert not assessment.is_valid  # Should reject due to high volatility
    assert assessment.take_profit_levels is None
    assert assessment.trailing_stop_level is None
    assert assessment.dynamic_position_size is None

    # Test borderline volatility
    trade["volatility"] = 1.8  # High but acceptable
    assessment = await risk_manager.assess_trade(trade)
    assert assessment.is_valid
    assert (
        assessment.dynamic_position_size < trade["amount"]
    )  # Position size should be reduced
    assert len(assessment.take_profit_levels) == 3
    assert assessment.trailing_stop_level > trade["price"]
    assert any("volatility" in rec.lower() for rec in assessment.recommendations)


@pytest.mark.asyncio
async def test_extreme_market_conditions(risk_manager):
    # Test flash crash scenario
    flash_crash = create_trade_dict(
        symbol="ETH/USD",
        amount=5,
        price=2000,
        volatility=3.0,
        liquidity=50000,  # Very low liquidity
        spread=0.05,  # Maximum allowed spread
        volume=500,  # Low volume
    )
    assessment = await risk_manager.assess_trade(flash_crash)
    assert not assessment.is_valid
    assert "market conditions" in assessment.reason.lower()
    assert assessment.take_profit_levels is None
    assert assessment.trailing_stop_level is None
    assert assessment.dynamic_position_size is None

    # Test maximum leverage scenario
    max_leverage = create_trade_dict(
        symbol="BTC/USD",
        side="buy",
        amount=1,
        price=50000,
        account_size=10000,
        leverage=20,  # Maximum allowed leverage
        volatility=1.2,
        liquidity=2000000,
        spread=0.001,
        volume=15000,
        existing_positions=[],
    )
    assessment = await risk_manager.assess_trade(max_leverage)
    assert assessment.is_valid
    assert assessment.dynamic_position_size <= max_leverage["amount"]
    assert len(assessment.take_profit_levels) == 3
    assert assessment.trailing_stop_level > max_leverage["price"]

    # Test minimum account size scenario
    min_account = create_trade_dict(
        symbol="SOL/USD",
        side="buy",
        amount=0.1,
        price=100,
        account_size=100,  # Very small account
        volatility=1.0,
        liquidity=1000000,
        spread=0.002,
        volume=10000,
        existing_positions=[],
    )
    assessment = await risk_manager.assess_trade(min_account)
    assert assessment.is_valid
    assert assessment.dynamic_position_size <= min_account["amount"]
    assert len(assessment.take_profit_levels) == 3
    assert assessment.trailing_stop_level > min_account["price"]
    assert any("position size" in rec.lower() for rec in assessment.recommendations)


@pytest.mark.asyncio
async def test_concurrent_trades(risk_manager):
    # Test multiple trades in same market
    trade1 = create_trade_dict(amount=1, price=50000)
    trade2 = create_trade_dict(amount=0.5, price=50100)

    assessment1 = await risk_manager.assess_trade(trade1)
    assert assessment1.is_valid
    assert assessment1.dynamic_position_size <= trade1["amount"]

    assessment2 = await risk_manager.assess_trade(trade2)
    assert assessment2.is_valid
    assert assessment2.dynamic_position_size <= trade2["amount"]
    assert assessment2.dynamic_position_size < assessment1.dynamic_position_size

    # Test trades in different markets
    trade3 = create_trade_dict(
        symbol="ETH/USD",
        side="sell",
        amount=10,
        price=2500,
        volatility=1.1,
        liquidity=1500000,
        spread=0.002,
        volume=12000,
    )
    trade4 = create_trade_dict(
        symbol="SOL/USD",
        amount=100,
        price=95,
        volatility=1.3,
        liquidity=1000000,
        spread=0.002,
        volume=10000,
    )

    assessment3 = await risk_manager.assess_trade(trade3)
    assert assessment3.is_valid
    assert assessment3.dynamic_position_size <= trade3["amount"]

    assessment4 = await risk_manager.assess_trade(trade4)
    assert assessment4.is_valid
    assert assessment4.dynamic_position_size <= trade4["amount"]

    # Verify take-profit and trailing stop levels for all trades
    assert all(
        len(a.take_profit_levels) == 3
        for a in [assessment1, assessment2, assessment3, assessment4]
    )
    assert all(
        a.trailing_stop_level is not None
        for a in [assessment1, assessment2, assessment3, assessment4]
    )

    # Verify risk recommendations for concurrent trades
    assert any("position size" in rec.lower() for rec in assessment2.recommendations)


from src.shared.risk.trade_factory import create_trade_dict


@pytest.mark.asyncio
async def test_portfolio_risk_limits(risk_manager):
    # Test portfolio-wide risk limits
    existing_positions = [
        create_trade_dict(
            symbol="BTC/USD",
            amount=1,
            price=50000,
            unrealized_pnl=-5000,  # 10% drawdown on position
        ),
        create_trade_dict(
            symbol="ETH/USD",
            amount=10,
            price=3000,
            unrealized_pnl=-3000,  # 10% drawdown on position
        ),
    ]

    # Test new trade with existing drawdown
    new_trade = create_trade_dict(
        symbol="SOL/USD",
        amount=100,
        price=100,
        account_size=100000,
        existing_positions=existing_positions,
    )

    assessment = await risk_manager.assess_trade(new_trade)
    assert assessment.is_valid
    assert assessment.dynamic_position_size < new_trade["amount"]
    assert any("drawdown" in rec.lower() for rec in assessment.recommendations)

    # Test trade with severe drawdown
    severe_positions = [
        create_trade_dict(
            symbol="BTC/USD",
            amount=1,
            price=50000,
            unrealized_pnl=-7500,  # 15% drawdown
        )
    ]

    severe_trade = create_trade_dict(
        symbol="ETH/USD",
        amount=10,
        price=3000,
        account_size=100000,
        existing_positions=severe_positions,
    )

    severe_assessment = await risk_manager.assess_trade(severe_trade)
    assert not severe_assessment.is_valid
    assert "maximum drawdown" in severe_assessment.reason.lower()


@pytest.mark.asyncio
async def test_meme_coin_risk(risk_manager):
    # Test meme coin risk reduction
    meme_trade = create_trade_dict(
        symbol="DOGE/USD",
        amount=10000,
        price=0.1,
        volatility=1.5,
        liquidity=500000,
        spread=0.002,
        volume=5000,
        is_meme_coin=True,
    )

    assessment = await risk_manager.assess_trade(meme_trade)
    assert assessment.is_valid
    assert (
        assessment.dynamic_position_size <= meme_trade["amount"] * 0.5
    )  # 50% reduction
    assert len(assessment.take_profit_levels) == 3
    assert assessment.trailing_stop_level > meme_trade["price"]
    assert any("meme coin" in rec.lower() for rec in assessment.recommendations)

    # Test high volatility meme coin
    volatile_meme = meme_trade.copy()
    volatile_meme["volatility"] = 2.5
    volatile_assessment = await risk_manager.assess_trade(volatile_meme)
    assert not volatile_assessment.is_valid
    assert "volatility" in volatile_assessment.reason.lower()

    # Test low liquidity meme coin
    low_liq_meme = meme_trade.copy()
    low_liq_meme["liquidity"] = 50000
    low_liq_assessment = await risk_manager.assess_trade(low_liq_meme)
    assert not low_liq_assessment.is_valid
    assert "liquidity" in low_liq_assessment.reason.lower()


@pytest.mark.asyncio
async def test_pump_token_validation(risk_manager):
    """Test Pump.fun token validation and risk assessment."""
    # Test normal pump token
    pump_token = {
        "symbol": "PUMP/USDC",
        "market_cap": 5000000,
        "volume_24h": 2000000,
        "price_change_24h": 150.0,
        "liquidity": 1000000,
        "holder_distribution": {
            "top_10_holders": 45.0,
            "top_50_holders": 75.0,
            "unique_holders": 500
        },
        "social_metrics": {
            "twitter_mentions": 1000,
            "telegram_members": 5000,
            "sentiment_score": 0.8
        }
    }
    
    validation = await risk_manager.validate_pump_token(pump_token)
    assert validation["risk_score"] >= 0 and validation["risk_score"] <= 100
    assert "volume_analysis" in validation
    assert "holder_distribution" in validation
    assert "market_metrics" in validation
    assert "social_metrics" in validation
    
    # Test high-risk pump token
    high_risk_token = pump_token.copy()
    high_risk_token["holder_distribution"]["top_10_holders"] = 90.0
    high_risk_token["volume_24h"] = 10000000
    high_risk_token["price_change_24h"] = 500.0
    
    high_risk_validation = await risk_manager.validate_pump_token(high_risk_token)
    assert high_risk_validation["risk_score"] > validation["risk_score"]
    assert high_risk_validation["holder_distribution"]["concentration_risk"] > 0.8
    assert high_risk_validation["volume_analysis"]["unusual_activity"]
    
    # Test low-risk token
    low_risk_token = pump_token.copy()
    low_risk_token["holder_distribution"]["top_10_holders"] = 20.0
    low_risk_token["volume_24h"] = 1000000
    low_risk_token["price_change_24h"] = 50.0
    
    low_risk_validation = await risk_manager.validate_pump_token(low_risk_token)
    assert low_risk_validation["risk_score"] < validation["risk_score"]
    assert low_risk_validation["holder_distribution"]["concentration_risk"] < 0.5
    assert not low_risk_validation["volume_analysis"]["unusual_activity"]


@pytest.mark.asyncio
async def test_market_data_caching(risk_manager):
    from src.shared.models.cache import MarketDataCache
    from src.shared.models.database import delete_cache, get_cache, set_cache

    # Test market data caching
    trade = create_trade_dict()

    # First assessment should cache market data
    assessment1 = await risk_manager.assess_trade(trade)
    assert assessment1.is_valid

    # Verify cached data exists
    cached_data = await get_cache(f"market_data:{trade['symbol']}")
    assert cached_data is not None
    assert "price" in cached_data
    assert "volume" in cached_data

    # Second assessment should use cached data
    assessment2 = await risk_manager.assess_trade(trade)
    assert assessment2.is_valid
    assert assessment2.market_data_source == "cache"

    # Test cache expiration
    await delete_cache(f"market_data:{trade['symbol']}")
    assessment3 = await risk_manager.assess_trade(trade)
    assert assessment3.is_valid
    assert assessment3.market_data_source == "live"


@pytest.mark.asyncio
async def test_rate_limits_and_staleness(risk_manager):
    import time
    from datetime import datetime, timedelta

    from src.shared.models.cache import MarketDataCache, RateLimitCache
    from src.shared.models.database import delete_cache, get_cache, set_cache

    trade = create_trade_dict()

    # Test rate limiting
    for _ in range(5):  # Simulate multiple rapid requests
        assessment = await risk_manager.assess_trade(trade)
        assert assessment.is_valid

    # Should hit rate limit
    rate_limited = await risk_manager.assess_trade(trade)
    assert not rate_limited.is_valid
    assert "rate limit" in rate_limited.reason.lower()

    # Test data staleness
    current_time = time.time()
    market_data = MarketDataCache(
        symbol=trade["symbol"],
        price=49000.0,
        volume=14000.0,
        timestamp=current_time - 3600,  # 1 hour old data
        bid=48900.0,
        ask=49100.0,
        ttl=CacheConfig.MARKET_DATA_TTL,
    )
    await set_cache(f"market_data:{trade['symbol']}", market_data.model_dump_json())

    stale_assessment = await risk_manager.assess_trade(trade)
    assert stale_assessment.is_valid
    assert any("stale" in rec.lower() for rec in stale_assessment.recommendations)

    # Very stale data should be rejected
    stale_data = MarketDataCache(
        symbol=trade["symbol"],
        price=49000.0,
        volume=14000.0,
        timestamp=current_time - 7200,  # 2 hours old data
        bid=48900.0,
        ask=49100.0,
        ttl=CacheConfig.MARKET_DATA_TTL,
    )
    await set_cache(f"market_data:{trade['symbol']}", stale_data.model_dump_json())

    very_stale = await risk_manager.assess_trade(trade)
    assert not very_stale.is_valid
    assert "stale" in very_stale.reason.lower()


@pytest.mark.asyncio
async def test_correlation_based_sizing(risk_manager):
    # Test correlation-based position sizing
    eth_position = create_trade_dict(
        symbol="ETH/USD", amount=10, price=3000, margin_used=15000, unrealized_pnl=1000
    )

    # Test BTC trade with existing ETH position (high correlation)
    btc_trade = create_trade_dict(
        symbol="BTC/USD", amount=1, price=50000, existing_positions=[eth_position]
    )

    assessment1 = await risk_manager.assess_trade(btc_trade)
    assert assessment1.is_valid
    assert (
        assessment1.dynamic_position_size < btc_trade["amount"]
    )  # Should reduce size due to correlation
    assert any("correlation" in rec.lower() for rec in assessment1.recommendations)

    # Test SOL trade with existing ETH position (medium correlation)
    sol_trade = create_trade_dict(
        symbol="SOL/USD", amount=100, price=100, existing_positions=[eth_position]
    )

    assessment2 = await risk_manager.assess_trade(sol_trade)
    assert assessment2.is_valid
    assert assessment2.dynamic_position_size <= sol_trade["amount"]

    # Test DOGE trade with existing ETH position (low correlation)
    doge_trade = create_trade_dict(
        symbol="DOGE/USD",
        amount=10000,
        price=0.1,
        is_meme_coin=True,
        existing_positions=[eth_position],
    )

    assessment3 = await risk_manager.assess_trade(doge_trade)
    assert assessment3.is_valid
    assert (
        assessment3.dynamic_position_size <= doge_trade["amount"] * 0.5
    )  # Meme coin reduction

    # Test multiple correlated positions
    btc_position = create_trade_dict(
        symbol="BTC/USD", amount=1, price=50000, margin_used=25000, unrealized_pnl=-1000
    )

    eth_trade_with_btc = create_trade_dict(
        symbol="ETH/USD", amount=10, price=3000, existing_positions=[btc_position]
    )

    assessment4 = await risk_manager.assess_trade(eth_trade_with_btc)
    assert assessment4.is_valid
    assert assessment4.dynamic_position_size < eth_trade_with_btc["amount"]
    assert any("correlation" in rec.lower() for rec in assessment4.recommendations)
    assert any("drawdown" in rec.lower() for rec in assessment4.recommendations)
    eth_trade = btc_trade.copy()
    eth_trade["symbol"] = "ETH/USD"
    eth_trade["amount"] = 10
    eth_trade["price"] = 3000
    btc_position = create_trade_dict(symbol="BTC/USD", amount=1, price=50000)
    btc_position.update({"margin_used": 25000, "unrealized_pnl": -1000})
    eth_trade["existing_positions"] = [btc_position]

    assessment2 = await risk_manager.assess_trade(eth_trade)
    assert assessment2.is_valid
    assert assessment2.dynamic_position_size < eth_trade["amount"]
    assert any("correlated" in rec.lower() for rec in assessment2.recommendations)


@pytest.mark.asyncio
async def test_drawdown_limits(risk_manager):
    # Test drawdown limit enforcement
    eth_position = create_trade_dict(symbol="ETH/USD", amount=10, price=3000)
    eth_position.update(
        {"margin_used": 15000, "unrealized_pnl": -8000}  # High unrealized loss
    )
    trade = create_trade_dict(existing_positions=[eth_position])

    assessment = await risk_manager.assess_trade(trade)
    assert assessment.is_valid
    assert any("unrealized" in rec.lower() for rec in assessment.recommendations)
    assert assessment.dynamic_position_size < trade["amount"]

    # Test exceeding drawdown limit
    high_drawdown_trade = trade.copy()
    high_drawdown_trade["existing_positions"][0][
        "unrealized_pnl"
    ] = -15000  # 15% drawdown

    assessment2 = await risk_manager.assess_trade(high_drawdown_trade)
    assert not assessment2.is_valid
    assert "drawdown" in assessment2.reason.lower()


@pytest.mark.asyncio
async def test_liquidity_thresholds(risk_manager):
    # Test insufficient liquidity
    low_liquidity = create_trade_dict(
        symbol="BTC/USD",
        amount=1,
        price=50000,
        liquidity=50000,  # Below minimum
        volume=5000,
        spread=0.002,
    )
    assessment = await risk_manager.assess_trade(low_liquidity)
    assert not assessment.is_valid
    assert "liquidity" in assessment.reason.lower()
    assert assessment.dynamic_position_size is None

    # Test borderline liquidity
    borderline = create_trade_dict(
        symbol="ETH/USD",
        amount=10,
        price=3000,
        liquidity=100000,  # At minimum
        volume=8000,
        spread=0.002,
    )
    assessment2 = await risk_manager.assess_trade(borderline)
    assert assessment2.is_valid
    assert assessment2.dynamic_position_size < borderline["amount"]
    assert any("liquidity" in rec.lower() for rec in assessment2.recommendations)

    # Test high liquidity
    high_liquidity = create_trade_dict(
        symbol="BTC/USD",
        amount=1,
        price=50000,
        liquidity=2000000,  # Well above minimum
        volume=15000,
        spread=0.001,
    )
    assessment3 = await risk_manager.assess_trade(high_liquidity)
    assert assessment3.is_valid
    assert assessment3.dynamic_position_size == high_liquidity["amount"]
    assert not any("liquidity" in rec.lower() for rec in assessment3.recommendations)

    # Test dynamic liquidity adjustment
    large_trade = create_trade_dict(
        symbol="BTC/USD",
        amount=5,
        price=50000,
        liquidity=1000000,
        volume=10000,
        spread=0.002,
    )
    assessment4 = await risk_manager.assess_trade(large_trade)
    assert assessment4.is_valid
    assert assessment4.dynamic_position_size < large_trade["amount"]
    assert any("market impact" in rec.lower() for rec in assessment4.recommendations)


@pytest.mark.asyncio
async def test_slippage_and_spread(risk_manager):
    # Test normal market conditions
    base_trade = create_trade_dict(
        symbol="BTC/USD",
        amount=1,
        price=50000,
        spread=0.001,
        volume=15000,
        liquidity=2000000,
    )

    assessment = await risk_manager.assess_trade(base_trade)
    assert assessment.is_valid
    assert assessment.dynamic_position_size == base_trade["amount"]
    assert assessment.expected_slippage < 0.002

    # Test high spread impact
    high_spread = create_trade_dict(
        symbol="BTC/USD",
        amount=1,
        price=50000,
        spread=0.03,  # 3% spread
        volume=15000,
        liquidity=2000000,
    )

    assessment2 = await risk_manager.assess_trade(high_spread)
    assert not assessment2.is_valid
    assert "spread" in assessment2.reason.lower()
    assert assessment2.expected_slippage > 0.02  # MAX_SLIPPAGE

    # Test large order slippage
    large_trade = create_trade_dict(
        symbol="BTC/USD",
        amount=10,
        price=50000,
        spread=0.001,
        volume=15000,
        liquidity=2000000,
    )

    assessment3 = await risk_manager.assess_trade(large_trade)
    assert assessment3.is_valid
    assert assessment3.dynamic_position_size < large_trade["amount"]
    assert any("slippage" in rec.lower() for rec in assessment3.recommendations)

    # Test combined spread and size impact
    combined_impact = create_trade_dict(
        symbol="BTC/USD",
        amount=5,
        price=50000,
        spread=0.015,  # 1.5% spread
        volume=10000,
        liquidity=1000000,
    )

    assessment4 = await risk_manager.assess_trade(combined_impact)
    assert assessment4.is_valid
    assert assessment4.dynamic_position_size < combined_impact["amount"]
    assert assessment4.expected_slippage > assessment3.expected_slippage
    assert any("spread" in rec.lower() for rec in assessment4.recommendations)
    assert any("slippage" in rec.lower() for rec in assessment4.recommendations)


@pytest.mark.asyncio
async def test_take_profit_and_trailing_stop(risk_manager):
    # Test normal market conditions
    base_trade = create_trade_dict(
        symbol="BTC/USD", amount=1, price=50000, volatility=1.2, spread=0.001
    )

    assessment = await risk_manager.assess_trade(base_trade)
    assert assessment.is_valid
    assert len(assessment.take_profit_levels) == 3
    assert assessment.take_profit_levels == [51650, 52500, 55000]  # 3.3%, 5%, 10%
    assert assessment.trailing_stop_level == 51500  # 1.5x first take-profit

    # Test high volatility impact
    volatile_trade = create_trade_dict(
        symbol="BTC/USD", amount=1, price=50000, volatility=1.8, spread=0.001
    )

    assessment2 = await risk_manager.assess_trade(volatile_trade)
    assert assessment2.is_valid
    assert assessment2.trailing_stop_level > assessment.trailing_stop_level
    assert all(
        tp2 > tp1
        for tp1, tp2 in zip(
            assessment.take_profit_levels, assessment2.take_profit_levels
        )
    )
    assert any("volatility" in rec.lower() for rec in assessment2.recommendations)

    # Test trailing stop activation
    profit_trade = create_trade_dict(
        symbol="BTC/USD",
        amount=1,
        price=50000,
        unrealized_pnl=25000,  # 50% profit
        volatility=1.2,
        spread=0.001,
    )

    assessment3 = await risk_manager.assess_trade(profit_trade)
    assert assessment3.is_valid
    assert (
        assessment3.trailing_stop_level > profit_trade["price"] * 1.45
    )  # Higher trailing stop in profit
    assert any("trailing stop" in rec.lower() for rec in assessment3.recommendations)

    # Test combined factors
    combined_trade = create_trade_dict(
        symbol="BTC/USD",
        amount=1,
        price=50000,
        volatility=1.5,
        spread=0.002,
        unrealized_pnl=15000,  # 30% profit
    )

    assessment4 = await risk_manager.assess_trade(combined_trade)
    assert assessment4.is_valid
    assert assessment4.trailing_stop_level > assessment.trailing_stop_level
    assert all(
        tp4 > tp1
        for tp1, tp4 in zip(
            assessment.take_profit_levels, assessment4.take_profit_levels
        )
    )
    assert (
        len(
            [
                rec
                for rec in assessment4.recommendations
                if any(
                    x in rec.lower() for x in ["volatility", "trailing", "take-profit"]
                )
            ]
        )
        >= 2
    )


@pytest.mark.asyncio
async def test_market_impact_assessment(risk_manager):
    # Test normal market conditions
    base_trade = create_trade_dict(
        symbol="BTC/USD",
        amount=1,
        price=50000,
        liquidity=2000000,
        volume=15000,
        spread=0.001,
    )

    assessment1 = await risk_manager.assess_trade(base_trade)
    assert assessment1.is_valid
    assert assessment1.market_impact < 0.001
    assert assessment1.expected_slippage < 0.002
    assert assessment1.dynamic_position_size == base_trade["amount"]

    # Test large order impact
    large_trade = create_trade_dict(
        symbol="BTC/USD",
        amount=10,
        price=50000,
        liquidity=2000000,
        volume=15000,
        spread=0.001,
    )

    assessment2 = await risk_manager.assess_trade(large_trade)
    assert assessment2.is_valid
    assert assessment2.market_impact > assessment1.market_impact
    assert assessment2.expected_slippage > assessment1.expected_slippage
    assert assessment2.dynamic_position_size < large_trade["amount"]
    assert any("market impact" in rec.lower() for rec in assessment2.recommendations)

    # Test excessive market impact
    excessive_trade = create_trade_dict(
        symbol="BTC/USD",
        amount=50,
        price=50000,
        liquidity=100000,
        volume=5000,
        spread=0.002,
    )

    assessment3 = await risk_manager.assess_trade(excessive_trade)
    assert not assessment3.is_valid
    assert "market impact" in assessment3.reason.lower()
    assert assessment3.market_impact > 0.05  # 5% impact is too high

    # Test combined factors
    combined_trade = create_trade_dict(
        symbol="BTC/USD",
        amount=5,
        price=50000,
        liquidity=500000,
        volume=8000,
        spread=0.003,
        volatility=1.5,
    )

    assessment4 = await risk_manager.assess_trade(combined_trade)
    assert assessment4.is_valid
    assert assessment4.market_impact > assessment1.market_impact
    assert assessment4.dynamic_position_size < combined_trade["amount"]
    assert (
        len(
            [
                rec
                for rec in assessment4.recommendations
                if any(
                    x in rec.lower()
                    for x in ["market impact", "slippage", "volatility"]
                )
            ]
        )
        >= 2
    )


@pytest.mark.asyncio
async def test_dynamic_risk_adjustment(risk_manager):
    # Test normal market conditions
    base_trade = create_trade_dict(
        symbol="BTC/USD",
        amount=1,
        price=50000,
        volatility=1.2,
        spread=0.001,
        volume=15000,
        liquidity=2000000,
    )

    assessment1 = await risk_manager.assess_trade(base_trade)
    assert assessment1.is_valid
    assert assessment1.dynamic_position_size == base_trade["amount"]
    assert assessment1.market_impact < 0.001
    assert assessment1.expected_slippage < 0.002

    # Test high volatility adjustment
    volatile_trade = create_trade_dict(
        symbol="BTC/USD",
        amount=1,
        price=50000,
        volatility=2.0,  # Above VOLATILITY_SCALE_THRESHOLD
        spread=0.001,
        volume=15000,
        liquidity=2000000,
    )

    assessment2 = await risk_manager.assess_trade(volatile_trade)
    assert assessment2.is_valid
    assert assessment2.dynamic_position_size < base_trade["amount"]
    assert (
        assessment2.dynamic_position_size <= base_trade["amount"] * 0.7
    )  # POSITION_REDUCTION_RATE
    assert any("volatility" in rec.lower() for rec in assessment2.recommendations)

    # Test correlation adjustment
    eth_position = create_trade_dict(
        symbol="ETH/USD", amount=10, price=3000, volatility=1.2, unrealized_pnl=1000
    )

    btc_trade = create_trade_dict(
        symbol="BTC/USD",
        amount=1,
        price=50000,
        volatility=1.2,
        spread=0.001,
        volume=15000,
        liquidity=2000000,
        existing_positions=[eth_position],
    )

    assessment3 = await risk_manager.assess_trade(btc_trade)
    assert assessment3.is_valid
    assert assessment3.dynamic_position_size < base_trade["amount"]
    assert any("correlation" in rec.lower() for rec in assessment3.recommendations)

    # Test combined risk factors
    combined_trade = create_trade_dict(
        symbol="BTC/USD",
        amount=1,
        price=50000,
        volatility=1.8,
        spread=0.002,
        volume=10000,
        liquidity=1000000,
        existing_positions=[eth_position],
    )

    assessment4 = await risk_manager.assess_trade(combined_trade)
    assert assessment4.is_valid
    assert assessment4.dynamic_position_size < assessment2.dynamic_position_size
    assert assessment4.dynamic_position_size < assessment3.dynamic_position_size
    assert (
        len(
            [
                rec
                for rec in assessment4.recommendations
                if any(
                    x in rec.lower()
                    for x in ["volatility", "spread", "correlation", "liquidity"]
                )
            ]
        )
        >= 3
    )

    # Test extreme conditions
    extreme_trade = create_trade_dict(
        symbol="BTC/USD",
        amount=1,
        price=50000,
        volatility=2.5,
        spread=0.003,
        volume=5000,
        liquidity=500000,
        existing_positions=[eth_position],
    )

    assessment5 = await risk_manager.assess_trade(extreme_trade)
    assert not assessment5.is_valid
    assert any(x in assessment5.reason.lower() for x in ["volatility", "risk"])

    # Removed duplicate test_dynamic_risk_adjustment function

    # Test market impact
    large_trade = base_trade.copy()
    large_trade["amount"] = 10
    assessment5 = await risk_manager.assess_trade(large_trade)
    assert assessment5.is_valid
    assert assessment5.expected_slippage > 0.001
    assert any("market impact" in rec.lower() for rec in assessment5.recommendations)

    # Test market impact
    large_trade = base_trade.copy()
    large_trade["amount"] = 10
    assessment5 = await risk_manager.assess_trade(large_trade)
    assert assessment5.is_valid
    assert assessment5.expected_slippage > 0.001
    assert any("market impact" in rec.lower() for rec in assessment5.recommendations)


@pytest.mark.asyncio
async def test_market_impact_and_slippage(risk_manager):
    base_trade = create_trade_dict(
        amount=1.0,
        price=50000,
        volatility=1.2,
        liquidity=2000000,
        spread=0.001,
        volume=15000,
    )

    # Test normal market conditions
    assessment = await risk_manager.assess_trade(base_trade)
    assert assessment.is_valid
    assert assessment.market_impact < 0.001
    assert assessment.expected_slippage < 0.002
    assert len(assessment.take_profit_levels) == 3
    assert assessment.trailing_stop_level > base_trade["price"]

    # Test high spread impact
    high_spread = base_trade.copy()
    high_spread["spread"] = 0.05
    assessment2 = await risk_manager.assess_trade(high_spread)
    assert not assessment2.is_valid
    assert "spread" in assessment2.reason.lower()

    # Test low liquidity impact
    low_liquidity = base_trade.copy()
    low_liquidity["liquidity"] = 50000
    assessment3 = await risk_manager.assess_trade(low_liquidity)
    assert not assessment3.is_valid
    assert "liquidity" in assessment3.reason.lower()

    # Test large order impact
    large_order = base_trade.copy()
    large_order["amount"] = 100
    assessment4 = await risk_manager.assess_trade(large_order)
    assert assessment4.is_valid
    assert assessment4.dynamic_position_size < large_order["amount"]
    assert assessment4.market_impact > assessment.market_impact
    assert assessment4.expected_slippage > assessment.expected_slippage
    assert any("market impact" in rec.lower() for rec in assessment4.recommendations)
    assert len(assessment4.take_profit_levels) == 3
    assert assessment4.trailing_stop_level > large_order["price"]


@pytest.mark.asyncio
async def test_portfolio_risk_and_margin(risk_manager):
    eth_position = create_trade_dict(symbol="ETH/USD", amount=10, price=3000)
    eth_position.update({"margin_used": 15000, "unrealized_pnl": 1000})
    base_trade = create_trade_dict(
        margin_requirements={"initial": 0.1, "maintenance": 0.05},
        existing_positions=[eth_position],
    )

    # Test normal margin scenario
    assessment1 = await risk_manager.assess_trade(base_trade)
    assert assessment1.is_valid
    assert (
        assessment1.margin_requirements["required"] <= base_trade["account_size"] * 0.2
    )

    # Test approaching margin limit
    eth_position = create_trade_dict(symbol="ETH/USD", amount=10, price=3000)
    eth_position.update({"margin_used": 50000, "unrealized_pnl": 1000})
    assessment2 = await risk_manager.assess_trade(
        create_trade_dict(amount=3, existing_positions=[eth_position])
    )
    assert assessment2.is_valid
    assert any(
        "margin utilization" in rec.lower() for rec in assessment2.recommendations
    )

    # Test exceeding margin limit
    eth_position = create_trade_dict(symbol="ETH/USD", amount=10, price=3000)
    eth_position.update({"margin_used": 80000, "unrealized_pnl": 1000})
    assessment3 = await risk_manager.assess_trade(
        create_trade_dict(amount=5, existing_positions=[eth_position])
    )
    assert not assessment3.is_valid
    assert "margin requirement" in assessment3.reason.lower()

    # Test portfolio VaR limit with multiple positions
    eth_position = create_trade_dict(
        symbol="ETH/USD", amount=10, price=3000, volatility=1.5
    )
    eth_position.update({"margin_used": 15000, "unrealized_pnl": 1000})

    sol_position = create_trade_dict(
        symbol="SOL/USD", amount=100, price=100, volatility=2.0
    )
    sol_position.update({"margin_used": 5000, "unrealized_pnl": -2000})

    # Test high volatility with existing positions
    assessment1 = await risk_manager.assess_trade(
        create_trade_dict(
            volatility=2.5, existing_positions=[eth_position, sol_position]
        )
    )
    assert assessment1.is_valid
    assert assessment1.dynamic_position_size < 1.0
    assert any("portfolio risk" in rec.lower() for rec in assessment1.recommendations)
    assert len(assessment1.take_profit_levels) == 3
    assert assessment1.trailing_stop_level > 0

    # Test market impact with different conditions
    # Normal conditions
    assessment2 = await risk_manager.assess_trade(
        create_trade_dict(
            amount=1.0,
            price=50000,
            volatility=1.2,
            liquidity=2000000,
            spread=0.001,
            volume=15000,
        )
    )
    assert assessment2.is_valid
    assert assessment2.market_impact < 0.001
    assert assessment2.expected_slippage < 0.002
    assert len(assessment2.take_profit_levels) == 3

    # High impact conditions
    assessment3 = await risk_manager.assess_trade(
        create_trade_dict(
            amount=10.0,
            price=50000,
            volatility=1.8,
            liquidity=500000,
            spread=0.003,
            volume=7500,
        )
    )
    assert assessment3.is_valid
    assert assessment3.market_impact > assessment2.market_impact
    assert assessment3.expected_slippage > assessment2.expected_slippage
    assert assessment3.dynamic_position_size < 10.0
    assert any("market impact" in rec.lower() for rec in assessment3.recommendations)

    # Test combined risk factors
    assessment4 = await risk_manager.assess_trade(
        create_trade_dict(
            amount=5.0,
            price=50000,
            volatility=2.0,
            liquidity=750000,
            spread=0.004,
            volume=5000,
            existing_positions=[eth_position],
        )
    )
    assert assessment4.is_valid
    assert assessment4.dynamic_position_size < 5.0
    assert assessment4.market_impact > assessment2.market_impact
    assert (
        len(
            [
                rec
                for rec in assessment4.recommendations
                if any(
                    x in rec.lower()
                    for x in ["volatility", "liquidity", "spread", "correlation"]
                )
            ]
        )
        >= 3
    )

    # Test drawdown scenarios
    eth_position["unrealized_pnl"] = -8000  # 8% drawdown
    assessment5 = await risk_manager.assess_trade(
        create_trade_dict(existing_positions=[eth_position])
    )
    assert assessment5.is_valid
    assert assessment5.dynamic_position_size < assessment5.amount
    assert any("drawdown" in rec.lower() for rec in assessment5.recommendations)

    eth_position["unrealized_pnl"] = -12000  # 12% drawdown
    assessment6 = await risk_manager.assess_trade(
        create_trade_dict(existing_positions=[eth_position])
    )
    assert not assessment6.is_valid
    assert "drawdown limit" in assessment6.reason.lower()

    # Test correlation impact
    btc_position = create_trade_dict(
        symbol="BTC/USD", amount=1.0, price=50000, volatility=1.5
    )
    btc_position["unrealized_pnl"] = 2000

    eth_trade = create_trade_dict(
        symbol="ETH/USD",
        amount=10,
        price=3000,
        volatility=1.8,
        existing_positions=[btc_position],
    )

    assessment7 = await risk_manager.assess_trade(eth_trade)
    assert assessment7.is_valid
    assert assessment7.dynamic_position_size < eth_trade["amount"]
    assert any("correlation" in rec.lower() for rec in assessment7.recommendations)

    # Test uncorrelated asset
    xrp_trade = create_trade_dict(
        symbol="XRP/USD",
        amount=1000,
        price=1.0,
        volatility=1.5,
        existing_positions=[btc_position],
    )

    assessment8 = await risk_manager.assess_trade(xrp_trade)
    assert assessment8.is_valid
    assert assessment8.dynamic_position_size > assessment7.dynamic_position_size
    assert not any("correlation" in rec.lower() for rec in assessment8.recommendations)

    # Test rate limiting and market data caching
    from datetime import datetime, timedelta

    from src.shared.models.cache import MarketDataCache, RateLimitCache

    # Set up rate limit cache
    rate_limit = {
        "symbol": "BTC/USD",
        "requests": 5,
        "window_start": datetime.utcnow().timestamp(),
        "limit": 10,
        "window_size": 60,
    }
    rate_key = f"ratelimit:market:{rate_limit['symbol']}"
    await set_cache(rate_key, RateLimitCache(**rate_limit).model_dump_json())

    # Test with fresh market data
    market_data = {
        "symbol": "BTC/USD",
        "price": 50000,
        "volatility": 1.2,
        "liquidity": 2000000,
        "spread": 0.001,
        "volume": 15000,
        "timestamp": datetime.utcnow().timestamp(),
    }
    market_key = f"market:{market_data['symbol']}"
    await set_cache(market_key, MarketDataCache(**market_data).model_dump_json())

    trade = create_trade_dict(
        symbol="BTC/USD",
        amount=1.0,
        price=50000,
        volatility=1.2,
        liquidity=2000000,
        spread=0.001,
        volume=15000,
    )

    assessment9 = await risk_manager.assess_trade(trade)
    assert assessment9.is_valid
    assert assessment9.market_impact < 0.001
    assert assessment9.expected_slippage < 0.002
    assert len(assessment9.take_profit_levels) == 3

    # Test rate limit warning
    rate_limit["requests"] = 9
    await set_cache(rate_key, RateLimitCache(**rate_limit).model_dump_json())

    assessment10 = await risk_manager.assess_trade(trade)
    assert assessment10.is_valid
    assert any("rate limit" in rec.lower() for rec in assessment10.recommendations)

    # Test stale market data
    stale_data = market_data.copy()
    stale_data["timestamp"] = (datetime.utcnow() - timedelta(minutes=16)).timestamp()
    await set_cache(market_key, MarketDataCache(**stale_data).model_dump_json())

    assessment11 = await risk_manager.assess_trade(trade)
    assert assessment11.is_valid
    assert any("stale data" in rec.lower() for rec in assessment11.recommendations)

    # Clean up test data
    await delete_cache(rate_key)
    await delete_cache(market_key)
    eth_position["unrealized_pnl"] = -5000  # 5% drawdown
    assessment3 = await risk_manager.assess_trade(
        create_trade_dict(existing_positions=[eth_position])
    )
    assert assessment3.is_valid
    assert assessment3.dynamic_position_size > assessment1.dynamic_position_size

    # Test correlated asset
    eth_position = create_trade_dict(symbol="ETH/USD", amount=10, price=3000)
    eth_position["unrealized_pnl"] = 1000
    assessment1 = await risk_manager.assess_trade(
        create_trade_dict(existing_positions=[eth_position])
    )
    assert assessment1.is_valid
    assert assessment1.dynamic_position_size < assessment1.amount
    assert any("correlation" in rec.lower() for rec in assessment1.recommendations)

    # Test with additional correlated exposure
    eth_position = create_trade_dict(symbol="ETH/USD", amount=10, price=3000)
    eth_position["unrealized_pnl"] = 1000

    sol_position = create_trade_dict(symbol="SOL/USD", amount=100, price=100)
    sol_position["unrealized_pnl"] = 500

    assessment2 = await risk_manager.assess_trade(
        create_trade_dict(existing_positions=[eth_position, sol_position])
    )
    assert assessment2.is_valid
    assert assessment2.dynamic_position_size < assessment1.dynamic_position_size
    assert any("high correlation" in rec.lower() for rec in assessment2.recommendations)

    # Test uncorrelated asset
    eth_position = create_trade_dict(symbol="ETH/USD", amount=10, price=3000)
    eth_position["unrealized_pnl"] = 1000

    sol_position = create_trade_dict(symbol="SOL/USD", amount=100, price=100)
    sol_position["unrealized_pnl"] = 500

    assessment3 = await risk_manager.assess_trade(
        create_trade_dict(
            symbol="XRP/USD",
            price=1,
            amount=1000,
            existing_positions=[eth_position, sol_position],
        )
    )
    assert assessment3.is_valid
    assert assessment3.dynamic_position_size > assessment2.dynamic_position_size
    assert not any("correlation" in rec.lower() for rec in assessment3.recommendations)

    # Set up rate limit cache
    rate_limit = {
        "symbol": "BTC/USD",
        "requests": 5,
        "window_start": datetime.utcnow().timestamp(),
        "limit": 10,
        "window_size": 60,  # 1 minute window
    }
    rate_key = f"ratelimit:market:{rate_limit['symbol']}"
    await set_cache(rate_key, RateLimitCache(**rate_limit).model_dump_json())

    # Test trade with rate-limited data
    trade = create_trade_dict(
        symbol="BTC/USD",
        side="buy",
        amount=1,
        price=50000,
        account_size=100000,
        volatility=1.2,
        liquidity=2000000,
        spread=0.001,
        volume=15000,
        existing_positions=[],
    )

    # First assessment should work
    assessment1 = await risk_manager.assess_trade(trade)
    assert assessment1.is_valid

    # Update rate limit to exceed threshold
    rate_limit["requests"] = 11
    await set_cache(rate_key, RateLimitCache(**rate_limit).model_dump_json())

    # Second assessment should include rate limit warning
    assessment2 = await risk_manager.assess_trade(trade)
    assert assessment2.is_valid  # Still valid but with warning
    assert any("rate limit" in rec.lower() for rec in assessment2.recommendations)

    # Test stale market data handling
    stale_market = {
        "symbol": "BTC/USD",
        "price": 50000,
        "volatility": 1.2,
        "liquidity": 2000000,
        "spread": 0.001,
        "volume": 15000,
        "timestamp": (datetime.utcnow() - timedelta(minutes=30)).timestamp(),
    }
    market_key = f"market:{stale_market['symbol']}"
    await set_cache(market_key, MarketDataCache(**stale_market).model_dump_json())

    # Assessment with stale data should include warning
    assessment3 = await risk_manager.assess_trade(trade)
    assert assessment3.is_valid  # Still valid but with warning
    assert any("stale data" in rec.lower() for rec in assessment3.recommendations)

    # Clean up test data
    await delete_cache(rate_key)
    await delete_cache(market_key)

    market_data = {
        "symbol": "BTC/USD",
        "price": 50000,
        "volatility": 1.2,
        "liquidity": 2000000,
        "spread": 0.001,
        "volume": 15000,
        "timestamp": datetime.utcnow().timestamp(),
    }

    # Cache market data
    cache_key = f"market:{market_data['symbol']}"
    await set_cache(cache_key, MarketDataCache(**market_data).model_dump_json())

    # Test trade with cached data
    cached_data = await get_cache(cache_key)
    assert cached_data is not None

    # Create trade with cached market data
    cached_market = MarketDataCache.model_validate_json(cached_data)
    trade = create_trade_dict(
        symbol="BTC/USD",
        side="buy",
        amount=1,
        price=50100,
        account_size=100000,
        volatility=cached_market.volatility,
        liquidity=cached_market.liquidity,
        spread=cached_market.spread,
        volume=cached_market.volume,
        existing_positions=[],
    )

    # Assess trade with cached data
    trade["existing_positions"] = []
    assessment = await risk_manager.assess_trade(trade)
    assert assessment.is_valid
    assert assessment.dynamic_position_size <= trade["amount"]
    assert len(assessment.take_profit_levels) == 3
    assert assessment.trailing_stop_level > trade["price"]

    # Test stale data handling
    stale_data = {
        "symbol": "BTC/USD",
        "price": 50000,
        "volatility": 1.2,
        "liquidity": 2000000,
        "spread": 0.001,
        "volume": 15000,
        "timestamp": (datetime.utcnow() - timedelta(minutes=16)).timestamp(),
    }
    await set_cache(cache_key, MarketDataCache(**stale_data).model_dump_json())

    cached_data = await get_cache(cache_key)
    assert cached_data is not None
    cached_market = MarketDataCache.model_validate_json(cached_data)
    assert (datetime.utcnow().timestamp() - cached_market.timestamp) > 900  # 15 minutes

    # Assessment should still work but include warning
    assessment = await risk_manager.assess_trade(trade)
    assert assessment.is_valid
    assert any("market data" in rec.lower() for rec in assessment.recommendations)

    # First trade should be accepted
    base_trade["existing_positions"] = []
    assessment1 = await risk_manager.assess_trade(base_trade)
    assert assessment1.is_valid

    # Add existing position
    btc_position = create_trade_dict(symbol="BTC/USD", amount=1.5, price=50000)
    btc_position["entry_price"] = 49000
    base_trade["existing_positions"] = [btc_position]

    # Second trade should have reduced size due to existing position
    assessment2 = await risk_manager.assess_trade(base_trade)
    assert assessment2.is_valid
    assert assessment2.dynamic_position_size < assessment1.dynamic_position_size
    assert any(
        "existing position" in rec.lower() for rec in assessment2.recommendations
    )

    # Test max drawdown limit
    btc_position = create_trade_dict(symbol="BTC/USD", amount=3, price=50000)
    btc_position.update({"entry_price": 55000, "unrealized_pnl": -15000})
    base_trade["existing_positions"] = [btc_position]

    # Trade should be rejected due to max drawdown
    assessment3 = await risk_manager.assess_trade(base_trade)
    assert not assessment3.is_valid
    assert "drawdown" in assessment3.reason.lower()

    # Test correlation risk
    eth_position = create_trade_dict(symbol="ETH/USD", amount=50, price=2500)
    eth_position["entry_price"] = 2400
    base_trade["existing_positions"] = [eth_position]
    base_trade["symbol"] = "BTC/USD"

    # Trade should have reduced size due to correlation
    assessment4 = await risk_manager.assess_trade(base_trade)
    assert assessment4.is_valid
    assert assessment4.dynamic_position_size < base_trade["amount"]
    assert any("correlation" in rec.lower() for rec in assessment4.recommendations)
