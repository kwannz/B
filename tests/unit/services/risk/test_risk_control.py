from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from trading_agent.python.trading_agent import RiskController


@pytest.fixture
async def risk_controller():
    controller = RiskController()
    await controller.start()
    yield controller
    await controller.stop()


@pytest.fixture
def mock_exchange():
    exchange = MagicMock()
    exchange.fetch_positions = AsyncMock()
    exchange.fetch_balance = AsyncMock()
    exchange.create_order = AsyncMock()
    return exchange


@pytest.mark.asyncio
async def test_check_portfolio_risk(risk_controller, mock_exchange):
    portfolio = {
        "positions": [
            {
                "symbol": "BTC/USDT",
                "side": "long",
                "size": 1.0,
                "entry_price": 20000,
                "current_price": 21000,
                "unrealized_pnl": 1000,
            },
            {
                "symbol": "ETH/USDT",
                "side": "long",
                "size": 10.0,
                "entry_price": 1500,
                "current_price": 1600,
                "unrealized_pnl": 1000,
            },
        ],
        "total_value": 50000,
        "margin_used": 25000,
    }

    result = await risk_controller.check_portfolio_risk(portfolio)

    assert "risk_level" in result
    assert "risk_factors" in result
    assert "recommendations" in result
    assert isinstance(result["risk_level"], float)
    assert len(result["risk_factors"]) > 0


@pytest.mark.asyncio
async def test_check_drawdown_limits(risk_controller):
    portfolio_history = [
        {"timestamp": "2024-01-24T00:00:00Z", "value": 100000},
        {"timestamp": "2024-01-24T01:00:00Z", "value": 95000},
        {"timestamp": "2024-01-24T02:00:00Z", "value": 90000},
        {"timestamp": "2024-01-24T03:00:00Z", "value": 85000},
    ]

    max_drawdown_limit = 0.15  # 15%

    result = await risk_controller.check_drawdown_limits(
        portfolio_history, max_drawdown_limit
    )

    assert result["drawdown_limit_breached"] is True
    assert result["current_drawdown"] == pytest.approx(0.15)
    assert "mitigation_actions" in result


@pytest.mark.asyncio
async def test_check_exposure_limits(risk_controller):
    positions = [
        {"symbol": "BTC/USDT", "size": 1.0, "value": 20000},
        {"symbol": "ETH/USDT", "size": 10.0, "value": 15000},
    ]

    total_portfolio_value = 100000
    max_exposure_per_asset = 0.25  # 25%

    result = await risk_controller.check_exposure_limits(
        positions, total_portfolio_value, max_exposure_per_asset
    )

    assert result["exposure_limits_breached"] is False
    assert len(result["asset_exposures"]) == 2
    assert all(
        exp <= max_exposure_per_asset for exp in result["asset_exposures"].values()
    )


@pytest.mark.asyncio
async def test_check_leverage_limits(risk_controller):
    positions = [
        {"symbol": "BTC/USDT", "leverage": 3, "value": 20000},
        {"symbol": "ETH/USDT", "leverage": 2, "value": 15000},
    ]

    max_leverage = 5
    max_total_leverage = 4

    result = await risk_controller.check_leverage_limits(
        positions, max_leverage, max_total_leverage
    )

    assert result["leverage_limits_breached"] is False
    assert result["highest_leverage"] == 3
    assert result["total_leverage"] < max_total_leverage


@pytest.mark.asyncio
async def test_check_correlation_risk(risk_controller):
    positions = [
        {"symbol": "BTC/USDT", "size": 1.0},
        {"symbol": "ETH/USDT", "size": 10.0},
        {"symbol": "SOL/USDT", "size": 100.0},
    ]

    price_data = {
        "BTC/USDT": [19000 + i * 100 for i in range(100)],
        "ETH/USDT": [1400 + i * 10 for i in range(100)],
        "SOL/USDT": [20 + i * 0.1 for i in range(100)],
    }

    result = await risk_controller.check_correlation_risk(positions, price_data)

    assert "correlation_matrix" in result
    assert "high_correlation_pairs" in result
    assert "diversification_score" in result
    assert isinstance(result["diversification_score"], float)


@pytest.mark.asyncio
async def test_check_volatility_risk(risk_controller):
    market_data = {
        "BTC/USDT": {
            "prices": [19000 + i * 100 for i in range(100)],
            "volume": [1000000 for _ in range(100)],
        }
    }

    volatility_threshold = 0.02  # 2%

    result = await risk_controller.check_volatility_risk(
        market_data, volatility_threshold
    )

    assert "volatility_level" in result
    assert "risk_level" in result
    assert "recommendations" in result
    assert isinstance(result["volatility_level"], float)


@pytest.mark.asyncio
async def test_execute_risk_mitigation(risk_controller, mock_exchange):
    high_risk_positions = [
        {
            "symbol": "BTC/USDT",
            "side": "long",
            "size": 1.0,
            "current_price": 20000,
            "risk_score": 0.8,
        }
    ]

    mock_exchange.create_order.return_value = {"id": "123456", "status": "filled"}

    result = await risk_controller.execute_risk_mitigation(
        high_risk_positions, mock_exchange
    )

    assert result["success"] is True
    assert "actions_taken" in result
    assert len(result["actions_taken"]) > 0


@pytest.mark.asyncio
async def test_calculate_var(risk_controller):
    portfolio = {
        "positions": [
            {"symbol": "BTC/USDT", "size": 1.0, "current_price": 20000},
            {"symbol": "ETH/USDT", "size": 10.0, "current_price": 1500},
        ],
        "total_value": 50000,
    }

    confidence_level = 0.95
    time_horizon = "1d"

    result = await risk_controller.calculate_var(
        portfolio, confidence_level, time_horizon
    )

    assert "var_value" in result
    assert "confidence_level" in result
    assert "time_horizon" in result
    assert isinstance(result["var_value"], float)


@pytest.mark.asyncio
async def test_stress_test_portfolio(risk_controller):
    portfolio = {
        "positions": [{"symbol": "BTC/USDT", "size": 1.0, "current_price": 20000}],
        "total_value": 50000,
    }

    scenarios = [
        {"name": "market_crash", "price_change": -0.3},
        {"name": "high_volatility", "price_change": 0.1},
    ]

    result = await risk_controller.stress_test_portfolio(portfolio, scenarios)

    assert "scenario_results" in result
    assert "worst_case_loss" in result
    assert len(result["scenario_results"]) == len(scenarios)


@pytest.mark.asyncio
async def test_monitor_risk_metrics(risk_controller, mock_exchange):
    mock_exchange.fetch_positions.return_value = [
        {
            "symbol": "BTC/USDT",
            "size": 1.0,
            "current_price": 20000,
            "unrealized_pnl": 1000,
        }
    ]

    result = await risk_controller.monitor_risk_metrics(mock_exchange)

    assert "current_risk_level" in result
    assert "metrics" in result
    assert "alerts" in result
    assert isinstance(result["current_risk_level"], float)
