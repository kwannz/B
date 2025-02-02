import json
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import pytest

from tradingbot.backend.trading_agent.agents.trading_agent import TradingAgent
from tradingbot.shared.models.trading import OrderSide, OrderType, TradeStatus


@pytest.fixture
def mock_trading_config():
    return {
        "name": "test_trading_agent",
        "type": "trading",
        "enabled": True,
        "symbol": "SOL/USDT",
        "strategy_type": "momentum",
        "parameters": {
            "max_position_size": 1000,
            "min_profit_threshold": 0.02,
            "stop_loss_threshold": 0.05,
            "order_timeout": 60,
            "max_slippage": 0.01,
            "riskLevel": "medium",
            "tradeSize": 2.5,
        },
    }


@pytest.fixture
def trading_agent(mock_trading_config):
    with patch.dict(
        "os.environ",
        {"DEEPSEEK_API_KEY": "test_api_key", "DEEPSEEK_MODEL": "test-model"},
    ):
        agent = TradingAgent(
            mock_trading_config["name"],
            mock_trading_config["type"],
            mock_trading_config,
        )
        return agent


@pytest.mark.asyncio
async def test_trading_agent_initialization(trading_agent, mock_trading_config):
    """Test trading agent initialization"""
    assert trading_agent.name == mock_trading_config["name"]
    assert trading_agent.type == "trading"
    assert trading_agent.enabled == mock_trading_config["enabled"]
    assert trading_agent.parameters == mock_trading_config["parameters"]
    assert trading_agent.strategy_type == mock_trading_config["strategy_type"]
    assert trading_agent.risk_level == mock_trading_config["parameters"]["riskLevel"]
    assert trading_agent.trade_size == mock_trading_config["parameters"]["tradeSize"]
    assert hasattr(trading_agent, "wallet")
    assert trading_agent.api_key == "test_api_key"
    assert trading_agent.model == "test-model"


@pytest.mark.asyncio
async def test_analyze_market_conditions_success(trading_agent):
    """Test successful market condition analysis"""
    with patch.object(
        trading_agent, "analyze_text", new_callable=AsyncMock
    ) as mock_analyze:
        mock_analyze.return_value = {"sentiment": "positive", "score": 0.8}

        result = await trading_agent._analyze_market_conditions("SOL")

        assert "market_sentiment" in result
        assert "news_analysis" in result
        assert "social_analysis" in result
        assert "timestamp" in result
        assert isinstance(result["timestamp"], str)

        # Verify analyze_text was called 3 times (market, news, social)
        assert mock_analyze.call_count == 3


@pytest.mark.asyncio
async def test_analyze_market_conditions_error(trading_agent):
    """Test market condition analysis with error"""
    with patch.object(
        trading_agent, "analyze_text", side_effect=Exception("Analysis failed")
    ):
        result = await trading_agent._analyze_market_conditions("SOL")
        assert result == {}


@pytest.mark.asyncio
async def test_generate_strategy_success(trading_agent):
    """Test successful strategy generation"""
    market_data = {
        "symbol": "SOL/USDT",
        "price": 100.0,
        "volume_24h": 1000000.0,
        "market_cap": 1000000000.0,
        "timestamp": datetime.now().isoformat(),
    }

    mock_response = {
        "choices": [
            {
                "text": json.dumps(
                    {
                        "action": "buy",
                        "price": 100.0,
                        "size": 1.0,
                        "stop_loss": 95.0,
                        "take_profit": 110.0,
                        "confidence": 0.8,
                        "reasoning": "Strong momentum",
                        "risk_assessment": "Medium",
                        "sentiment_impact": "Positive",
                    }
                )
            }
        ]
    }

    with patch("aiohttp.ClientSession.post") as mock_post:
        mock_post.return_value.__aenter__.return_value.status = 200
        mock_post.return_value.__aenter__.return_value.json = AsyncMock(
            return_value=mock_response
        )

        strategy = await trading_agent._generate_strategy(market_data)

        assert strategy is not None
        assert strategy["action"] == "buy"
        assert strategy["confidence"] == 0.8


@pytest.mark.asyncio
async def test_generate_strategy_api_error(trading_agent):
    """Test strategy generation with API error"""
    market_data = {
        "symbol": "SOL/USDT",
        "price": 100.0,
        "timestamp": datetime.now().isoformat(),
    }

    with patch("aiohttp.ClientSession.post") as mock_post:
        mock_post.return_value.__aenter__.return_value.status = 500

        strategy = await trading_agent._generate_strategy(market_data)
        assert strategy is None


@pytest.mark.asyncio
async def test_generate_strategy_json_error(trading_agent):
    """Test strategy generation with JSON parsing error"""
    market_data = {
        "symbol": "SOL/USDT",
        "price": 100.0,
        "timestamp": datetime.now().isoformat(),
    }

    mock_response = {
        "choices": [{"text": "Invalid JSON"}]  # This will cause json.loads to fail
    }

    with patch("aiohttp.ClientSession.post") as mock_post:
        mock_post.return_value.__aenter__.return_value.status = 200
        mock_post.return_value.__aenter__.return_value.json = AsyncMock(
            return_value=mock_response
        )

        strategy = await trading_agent._generate_strategy(market_data)
        assert strategy is None


@pytest.mark.asyncio
async def test_generate_strategy_network_error(trading_agent):
    """Test strategy generation with network error"""
    market_data = {
        "symbol": "SOL/USDT",
        "price": 100.0,
        "timestamp": datetime.now().isoformat(),
    }

    with patch("aiohttp.ClientSession.post", side_effect=Exception("Network error")):
        strategy = await trading_agent._generate_strategy(market_data)
        assert strategy is None


@pytest.mark.asyncio
async def test_start_insufficient_balance(trading_agent):
    """Test start with insufficient balance"""
    with patch.object(
        trading_agent, "get_wallet_balance", new_callable=AsyncMock
    ) as mock_balance:
        mock_balance.return_value = 0.1  # Less than required 0.5

        await trading_agent.start()
        assert trading_agent.status == "error"


@pytest.mark.asyncio
async def test_start_success(trading_agent):
    """Test successful start"""
    with patch.multiple(
        trading_agent,
        get_wallet_balance=AsyncMock(return_value=1.0),
        _generate_strategy=AsyncMock(return_value={"action": "buy"}),
    ):
        await trading_agent.start()
        assert trading_agent.status == "active"


@pytest.mark.asyncio
async def test_start_strategy_generation_error(trading_agent):
    """Test start with strategy generation error"""
    with patch.multiple(
        trading_agent,
        get_wallet_balance=AsyncMock(return_value=1.0),
        _generate_strategy=AsyncMock(
            side_effect=Exception("Strategy generation failed")
        ),
    ):
        with pytest.raises(Exception, match="Failed to start trading agent"):
            await trading_agent.start()
        assert trading_agent.status == "error"


@pytest.mark.asyncio
async def test_stop(trading_agent):
    """Test stop functionality"""
    await trading_agent.stop()
    assert trading_agent.status == "inactive"
    assert isinstance(trading_agent.last_update, str)


@pytest.mark.asyncio
async def test_update_config(trading_agent):
    """Test configuration update"""
    new_config = {
        "strategy_type": "mean_reversion",
        "parameters": {"riskLevel": "high", "tradeSize": 5.0},
    }

    await trading_agent.update_config(new_config)
    assert trading_agent.strategy_type == "mean_reversion"
    assert trading_agent.risk_level == "high"
    assert trading_agent.trade_size == 5.0
    assert isinstance(trading_agent.last_update, str)


@pytest.mark.asyncio
async def test_get_wallet_balance_success(trading_agent):
    """Test successful wallet balance retrieval"""
    with patch.object(
        trading_agent.wallet, "get_balance", new_callable=AsyncMock
    ) as mock_balance:
        mock_balance.return_value = 10.0
        balance = await trading_agent.get_wallet_balance()
        assert balance == 10.0


@pytest.mark.asyncio
async def test_get_wallet_balance_error(trading_agent):
    """Test wallet balance retrieval with error"""
    with patch.object(
        trading_agent.wallet, "get_balance", side_effect=Exception("Balance error")
    ):
        balance = await trading_agent.get_wallet_balance()
        assert balance == 0.0


def test_validate_parameters_success(trading_agent):
    """Test successful parameter validation"""
    valid_params = {
        "max_position_size": 1000,
        "min_profit_threshold": 0.02,
        "stop_loss_threshold": 0.05,
        "order_timeout": 60,
        "max_slippage": 0.01,
    }
    trading_agent.parameters = valid_params
    trading_agent.validate_parameters()  # Should not raise exception


def test_validate_parameters_invalid(trading_agent):
    """Test parameter validation with invalid values"""
    test_cases = [
        {"max_position_size": 0},
        {"min_profit_threshold": 0},
        {"stop_loss_threshold": 0},
        {"order_timeout": 0},
        {"max_slippage": 0},
        {"max_position_size": -1},
        {"min_profit_threshold": -0.1},
        {"stop_loss_threshold": -0.05},
        {"order_timeout": -10},
        {"max_slippage": -0.01},
    ]

    for invalid_params in test_cases:
        trading_agent.parameters = invalid_params
        with pytest.raises(ValueError):
            trading_agent.validate_parameters()


def test_validate_parameters_missing(trading_agent):
    """Test parameter validation with missing parameters"""
    test_cases = [
        {},  # Empty parameters
        {"max_position_size": 1000},  # Missing other parameters
        {"min_profit_threshold": 0.02},  # Missing other parameters
        {"stop_loss_threshold": 0.05},  # Missing other parameters
        {"order_timeout": 60},  # Missing other parameters
        {"max_slippage": 0.01},  # Missing other parameters
    ]

    for missing_params in test_cases:
        trading_agent.parameters = missing_params
        with pytest.raises(ValueError):
            trading_agent.validate_parameters()


def test_validate_parameters_all_valid(trading_agent):
    """Test parameter validation with all valid parameters"""
    valid_params = {
        "max_position_size": 1000,
        "min_profit_threshold": 0.02,
        "stop_loss_threshold": 0.05,
        "order_timeout": 60,
        "max_slippage": 0.01,
    }
    trading_agent.parameters = valid_params
    trading_agent.validate_parameters()  # Should not raise exception


def test_validate_parameters_edge_cases(trading_agent):
    """Test parameter validation with edge cases"""
    edge_cases = [
        {
            "max_position_size": 0.000001,
            "min_profit_threshold": 0.000001,
            "stop_loss_threshold": 0.000001,
            "order_timeout": 1,
            "max_slippage": 0.000001,
        },
        {
            "max_position_size": float("inf"),
            "min_profit_threshold": 1.0,
            "stop_loss_threshold": 1.0,
            "order_timeout": 999999,
            "max_slippage": 1.0,
        },
    ]

    for params in edge_cases:
        trading_agent.parameters = params
        trading_agent.validate_parameters()  # Should not raise exception


def test_get_status(trading_agent):
    """Test status retrieval"""
    status = trading_agent.get_status()
    assert "strategy_type" in status
    assert "risk_level" in status
    assert "trade_size" in status
    assert "wallet_address" in status
    assert status["strategy_type"] == trading_agent.strategy_type
    assert status["risk_level"] == trading_agent.risk_level
    assert status["trade_size"] == trading_agent.trade_size
    assert status["wallet_address"] == trading_agent.wallet.get_public_key()
