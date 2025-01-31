import pytest
from decimal import Decimal
from datetime import datetime
from src.shared.trading.market_making import MarketMaker

@pytest.fixture
def config():
    return {
        "min_spread": "0.002",
        "max_spread": "0.02",
        "volume_threshold": "10000",
        "position_limit": "1000",
        "meme_spread_multiplier": "1.5"
    }

@pytest.fixture
async def maker(config):
    maker = MarketMaker(config)
    await maker.start()
    yield maker
    await maker.stop()

@pytest.fixture
def market_data():
    return {
        "price": "100.0",
        "volume": "5000.0",
        "timestamp": datetime.utcnow().isoformat()
    }

def test_calculate_spread(maker):
    volume = Decimal("5000")
    spread = maker.calculate_spread(volume)
    expected_spread = maker.min_spread + (
        (maker.max_spread - maker.min_spread) * 
        (Decimal("1") - (volume / maker.volume_threshold))
    )
    assert spread == expected_spread
    
    meme_spread = maker.calculate_spread(volume, is_meme=True)
    assert meme_spread == expected_spread * maker.meme_spread_multiplier

async def test_calculate_order_prices(maker):
    market_price = Decimal("100")
    spread = Decimal("0.01")
    
    prices = await maker.calculate_order_prices(market_price, spread)
    assert "bid" in prices
    assert "ask" in prices
    
    half_spread = spread / Decimal("2")
    assert prices["bid"] == market_price * (Decimal("1") - half_spread)
    assert prices["ask"] == market_price * (Decimal("1") + half_spread)

async def test_should_update_orders(maker):
    token = "TEST"
    current_prices = {
        "bid": Decimal("99"),
        "ask": Decimal("101")
    }
    
    should_update = await maker.should_update_orders(token, current_prices)
    assert should_update is True
    
    maker.active_orders[token] = [
        {"side": "BID", "price": "99.0"},
        {"side": "ASK", "price": "101.0"}
    ]
    should_update = await maker.should_update_orders(token, current_prices)
    assert should_update is False

async def test_update_orders(maker, market_data):
    token = "TEST"
    quote_token = "USDT"
    
    orders = await maker.update_orders(token, quote_token, market_data)
    assert len(orders) == 2
    assert all(order["token"] == token for order in orders)
    assert all(order["quote_token"] == quote_token for order in orders)
    assert any(order["side"] == "BID" for order in orders)
    assert any(order["side"] == "ASK" for order in orders)

def test_get_active_orders(maker):
    token = "TEST"
    orders = [
        {"side": "BID", "price": "99.0"},
        {"side": "ASK", "price": "101.0"}
    ]
    maker.active_orders[token] = orders
    
    active_orders = maker.get_active_orders(token)
    assert active_orders == orders
    
    inactive_orders = maker.get_active_orders("NONEXISTENT")
    assert inactive_orders == []
