import pytest
from decimal import Decimal
from datetime import datetime
from src.shared.monitoring.volume_monitor import VolumeMonitor
from src.shared.models.market_data import MarketData
from src.shared.models.alerts import AlertType, AlertSeverity

@pytest.fixture
def config():
    return {
        "volume_threshold": "2.0",
        "window_size": 5,
        "min_volume": "1000.0"
    }

@pytest.fixture
def monitor(config):
    return VolumeMonitor(config)

@pytest.fixture
def market_data():
    def create_data(volume: float) -> MarketData:
        return MarketData(
            symbol="TEST/USDT",
            price=Decimal("1.0"),
            volume=Decimal(str(volume)),
            timestamp=datetime.utcnow()
        )
    return create_data

async def test_volume_surge_detection(monitor, market_data):
    token = "TEST/USDT"
    
    volumes = [1000.0, 1200.0, 1100.0, 1300.0, 3000.0]
    for volume in volumes:
        await monitor.update_market_data(token, market_data(volume))
    
    alert = await monitor.check_volume_surge(token)
    assert alert is not None
    assert alert.type == AlertType.VOLUME_SURGE
    assert alert.severity == AlertSeverity.HIGH
    assert alert.token == token
    assert alert.data["surge_ratio"] > 2.0

async def test_insufficient_data(monitor, market_data):
    token = "TEST/USDT"
    
    volumes = [1000.0, 1200.0]
    for volume in volumes:
        await monitor.update_market_data(token, market_data(volume))
    
    alert = await monitor.check_volume_surge(token)
    assert alert is None

async def test_below_min_volume(monitor, market_data):
    token = "TEST/USDT"
    
    volumes = [100.0, 120.0, 110.0, 130.0, 300.0]
    for volume in volumes:
        await monitor.update_market_data(token, market_data(volume))
    
    alert = await monitor.check_volume_surge(token)
    assert alert is None

async def test_multiple_tokens(monitor, market_data):
    tokens = ["TEST1/USDT", "TEST2/USDT"]
    
    for token in tokens:
        volumes = [1000.0, 1200.0, 1100.0, 1300.0, 3000.0]
        for volume in volumes:
            await monitor.update_market_data(token, market_data(volume))
    
    alerts = await monitor.check_all_tokens()
    assert len(alerts) == 2
    assert all(alert.type == AlertType.VOLUME_SURGE for alert in alerts)

async def test_token_stats(monitor, market_data):
    token = "TEST/USDT"
    
    volumes = [1000.0, 1200.0, 1100.0, 1300.0, 1500.0]
    for volume in volumes:
        await monitor.update_market_data(token, market_data(volume))
    
    stats = monitor.get_token_stats(token)
    assert stats["current_volume"] == 1500.0
    assert stats["average_volume"] == 1220.0
    assert stats["max_volume"] == 1500.0
    assert stats["min_volume"] == 1000.0
    assert stats["data_points"] == 5
