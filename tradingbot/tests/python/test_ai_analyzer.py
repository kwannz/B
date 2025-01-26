import os
import pytest
import json
from datetime import datetime
from unittest.mock import Mock, patch, AsyncMock

from tradingbot.shared.ai_analyzer import AIAnalyzer
from tradingbot.trading_agent.python.analysis.strategy_analyzer import StrategyAnalyzer

# 测试数据
MOCK_MARKET_DATA = {
    "current_price": 100.0,
    "volume_24h": 1000000.0,
    "price_change_24h": 5.0,
    "candles": [
        {
            "timestamp": "2024-02-25T00:00:00Z",
            "open": 95.0,
            "high": 102.0,
            "low": 94.0,
            "close": 100.0,
            "volume": 50000.0,
        },
        {
            "timestamp": "2024-02-25T01:00:00Z",
            "open": 100.0,
            "high": 103.0,
            "low": 99.0,
            "close": 101.0,
            "volume": 45000.0,
        },
    ],
}

MOCK_DEEPSEEK_RESPONSE = {
    "choices": [
        {
            "message": {
                "content": json.dumps(
                    {
                        "timestamp": datetime.now().isoformat(),
                        "signals": ["MACD golden cross", "RSI oversold"],
                        "indicators": {
                            "macd": {"value": 0.5, "signal": 0.2},
                            "rsi": {"value": 30, "signal": "oversold"},
                        },
                        "risks": {
                            "market_volatility": "low",
                            "liquidity_risk": "low",
                            "trend_strength": "high",
                        },
                        "recommendations": ["Consider long position", "Set stop loss"],
                        "confidence": 0.85,
                    }
                )
            }
        }
    ]
}


@pytest.fixture
async def ai_analyzer():
    """创建AI分析器实例"""
    analyzer = AIAnalyzer()
    await analyzer.initialize()
    yield analyzer
    await analyzer.close()


@pytest.fixture
async def strategy_analyzer():
    """创建策略分析器实例"""
    analyzer = StrategyAnalyzer()
    await analyzer.initialize()
    yield analyzer
    await analyzer.close()


@pytest.mark.asyncio
async def test_ai_analyzer_initialization(ai_analyzer):
    """测试AI分析器初始化"""
    assert ai_analyzer.api_key is not None
    assert ai_analyzer.session is not None
    assert ai_analyzer.min_confidence == 0.7
    assert ai_analyzer.max_retries > 0
    assert ai_analyzer.retry_delay > 0


@pytest.mark.asyncio
async def test_market_analysis(ai_analyzer):
    """测试市场分析功能"""
    # Create test data
    market_data = {
        "price_history": [
            {"timestamp": "2024-01-20T00:00:00", "price": 100.0},
            {"timestamp": "2024-01-20T00:01:00", "price": 101.0},
            {"timestamp": "2024-01-20T00:02:00", "price": 102.0},
            {"timestamp": "2024-01-20T00:03:00", "price": 103.0},
            {"timestamp": "2024-01-20T00:04:00", "price": 104.0},
        ],
        "current_price": 105.0,
        "volume_24h": 1000000.0,
        "indicators": {"rsi": 65, "macd": 0.5, "volatility": 0.02},
    }

    # Test successful analysis
    with patch.object(ai_analyzer.session, "post") as mock_post:
        mock_response = Mock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value=MOCK_DEEPSEEK_RESPONSE)
        mock_post.return_value.__aenter__.return_value = mock_response

        # Execute analysis
        result = await ai_analyzer.analyze_trading_opportunity(market_data)

        # Verify results
        assert result is not None
        assert "timestamp" in result
        assert "signals" in result
        assert "indicators" in result
        assert "risks" in result
        assert "recommendations" in result
        assert "confidence" in result
        assert 0 <= result["confidence"] <= 1


@pytest.mark.asyncio
async def test_strategy_validation(ai_analyzer):
    """测试策略验证功能"""
    # Test data
    risk_data = {
        "strategy": {
            "action": "buy",
            "amount": 1.0,
            "price": 100.0,
            "stop_loss": 95.0,
            "take_profit": 110.0,
        },
        "portfolio": {
            "total_value": 10000.0,
            "current_exposure": 0.3,
            "risk_score": 0.4,
        },
        "market_conditions": {
            "volatility": 0.02,
            "liquidity": "high",
            "trend": "bullish",
        },
    }

    # Test trade validation
    with patch.object(ai_analyzer.session, "post") as mock_post:
        mock_response = Mock()
        mock_response.status = 200
        mock_response.json = AsyncMock(
            return_value={
                "is_valid": True,
                "confidence": 0.85,
                "risk_assessment": {
                    "risk_level": "moderate",
                    "max_loss": 5.0,
                    "position_size": "appropriate",
                },
                "recommendations": ["proceed with trade", "set stop loss"],
            }
        )
        mock_post.return_value.__aenter__.return_value = mock_response

        # Convert risk data to trade data format
        trade_data = {
            "action": risk_data["strategy"]["action"],
            "amount": risk_data["strategy"]["amount"],
            "price": risk_data["strategy"]["price"],
            "stop_loss": risk_data["strategy"]["stop_loss"],
            "take_profit": risk_data["strategy"]["take_profit"],
        }

        market_analysis = {
            "market_conditions": risk_data["market_conditions"],
            "portfolio": risk_data["portfolio"],
        }

        result = await ai_analyzer.validate_trade(trade_data, market_analysis)

        assert result is not None
        assert result["is_valid"] is True
        assert 0 <= result["confidence"] <= 1
        assert "risk_assessment" in result
        assert "recommendations" in result


@pytest.mark.asyncio
async def test_historical_analysis(ai_analyzer):
    """测试历史数据分析"""
    historical_data = [
        {
            "timestamp": "2024-02-24T00:00:00Z",
            "price": 100.0,
            "amount": 1.0,
            "type": "buy",
            "result": "profit",
        },
        {
            "timestamp": "2024-02-24T01:00:00Z",
            "price": 102.0,
            "amount": 1.0,
            "type": "sell",
            "result": "profit",
        },
    ]

    with patch.object(ai_analyzer.session, "post") as mock_post:
        mock_response = Mock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value=MOCK_DEEPSEEK_RESPONSE)
        mock_post.return_value.__aenter__.return_value = mock_response

        result = await ai_analyzer.analyze_market_data(
            price_history=[
                {"timestamp": d["timestamp"], "price": d["price"]}
                for d in historical_data
            ],
            current_price=102.0,
            volume_data={"volume_24h": 1000000.0},
        )

        assert result is not None
        assert "recommendation" in result
        assert "confidence" in result
        assert "signals" in result
        assert "predicted_price" in result
        assert "risk_level" in result


@pytest.mark.asyncio
async def test_strategy_analyzer_integration(strategy_analyzer):
    """测试策略分析器集成"""
    # 模拟依赖组件
    strategy_analyzer.dex_aggregator.get_market_summary = Mock(
        return_value=MOCK_MARKET_DATA
    )

    strategy_analyzer.wallet_manager.get_wallet_info = Mock(
        return_value={"balance": 10000.0}
    )

    strategy_analyzer.dex_aggregator.execute_trade = Mock(
        return_value={
            "order_id": "test_order",
            "status": "executed",
            "executed_price": 100.0,
            "executed_amount": 1.0,
        }
    )

    # 执行分析和交易
    result = await strategy_analyzer.analyze_and_execute()

    # 验证结果
    assert result is not None
    assert "order_id" in result
    assert result["status"] == "executed"


@pytest.mark.asyncio
async def test_risk_management(strategy_analyzer):
    """测试风险管理功能"""
    analysis = {
        "action": "buy",
        "confidence": 0.8,
        "market_data": MOCK_MARKET_DATA,
        "stop_loss": 95.0,
        "take_profit": 110.0,
    }

    # 模拟钱包信息
    strategy_analyzer.wallet_manager.get_wallet_info = Mock(
        return_value={"balance": 10000.0}
    )

    # 检查风险
    risk_check = await strategy_analyzer._check_risk(analysis)
    assert risk_check["passed"] is True
    assert "position_size" in risk_check
    assert "portfolio_value" in risk_check


@pytest.mark.asyncio
async def test_performance_analysis(strategy_analyzer):
    """测试性能分析功能"""
    # 添加模拟交易历史
    strategy_analyzer.trade_history = [
        {
            "trade_result": {
                "status": "executed",
                "executed_price": 105.0,
                "price": 100.0,
            }
        },
        {
            "trade_result": {
                "status": "executed",
                "executed_price": 95.0,
                "price": 100.0,
            }
        },
    ]

    # 分析性能
    performance = await strategy_analyzer.analyze_performance()

    # 验证结果
    assert performance is not None
    assert performance["total_trades"] == 2
    assert performance["successful_trades"] >= 0
    assert 0 <= performance["success_rate"] <= 1
    assert isinstance(performance["avg_profit"], (int, float))
    assert isinstance(performance["total_profit"], (int, float))


@pytest.mark.asyncio
async def test_trade_monitoring(strategy_analyzer):
    """测试交易监控功能"""
    # 添加活动交易
    strategy_analyzer.active_trades = {
        "test_order": {
            "order_id": "test_order",
            "amount": 1.0,
            "price": 100.0,
            "status": "open",
            "type": "buy",
            "timestamp": datetime.now().isoformat(),
        }
    }

    # 模拟订单状态更新
    mock_order_status = {
        "status": "filled",
        "executed_price": 102.0,
        "executed_amount": 1.0,
        "fee": 0.1,
        "timestamp": datetime.now().isoformat(),
    }
    strategy_analyzer.dex_aggregator = Mock()
    strategy_analyzer.dex_aggregator.get_order_status = AsyncMock(
        return_value=mock_order_status
    )

    # 运行一次监控循环
    with patch("asyncio.sleep", AsyncMock()):
        await strategy_analyzer._monitor_trades()  # Use internal method name

    # 验证交易更新
    assert "test_order" not in strategy_analyzer.active_trades
    assert len(strategy_analyzer.trade_history) > 0
    trade = strategy_analyzer.trade_history[0]
    assert trade["trade_result"]["status"] == "filled"
    assert trade["trade_result"]["executed_price"] == 102.0


if __name__ == "__main__":
    pytest.main(["-v", __file__])
