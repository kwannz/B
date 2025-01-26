import pytest
from unittest.mock import patch, MagicMock
from tradingbot.trading_agent.utils.metrics import MetricsCollector, POSITION_RISK


@pytest.fixture
def mock_config():
    with patch("src.trading_agent.utils.metrics.config") as mock:
        mock.get.return_value = True
        yield mock


def test_metrics_initialization(mock_config):
    collector = MetricsCollector()
    assert collector.enabled == True
    assert collector.started == False


def test_record_position_risk():
    # Test that position risk metrics are properly recorded
    strategy = "test_strategy"
    symbol = "SOL/USD"
    risk_score = 0.5

    # Clear any existing metrics
    if hasattr(POSITION_RISK, "_metrics"):
        POSITION_RISK._metrics.clear()

    POSITION_RISK.labels(strategy=strategy, symbol=symbol, risk_type="overall").set(
        risk_score
    )

    # Get the value
    samples = list(POSITION_RISK.collect()[0].samples)
    matching_samples = [
        s
        for s in samples
        if s.labels.get("strategy") == strategy
        and s.labels.get("symbol") == symbol
        and s.labels.get("risk_type") == "overall"
    ]

    assert len(matching_samples) == 1
    sample = matching_samples[0]
    assert sample.labels["strategy"] == strategy
    assert sample.labels["symbol"] == symbol
    assert sample.labels["risk_type"] == "overall"
    assert sample.value == risk_score


@patch("src.trading_agent.utils.metrics.start_http_server")
def test_metrics_collector_start(mock_start_server, mock_config):
    collector = MetricsCollector()
    collector.start()
    assert collector.started == True
    mock_start_server.assert_called_once_with(collector.port)
