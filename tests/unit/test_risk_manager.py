"""
风险管理器测试
"""
import pytest
from decimal import Decimal
from datetime import datetime
from unittest.mock import Mock, patch, AsyncMock

# Mock AI dependencies
import sys
sys.modules['trading_agent.python.ai.analyzer'] = Mock()

<<<<<<< HEAD
from tradingbot.python.risk.manager import RiskManager
from tradingbot.shared.errors import RiskError
||||||| fa1bd03
from tradingbot.trading_agent.python.risk.manager import RiskManager
from tradingbot.shared.errors import RiskError
=======
from trading_agent.python.risk.manager import RiskManager
from trading_agent.python.errors import RiskError
>>>>>>> origin/main

@pytest.fixture
async def risk_manager():
    """创建风险管理器实例"""
    manager = RiskManager()
    yield manager

@pytest.mark.asyncio
async def test_check_trade_validation(risk_manager):
    """测试交易验证"""
    # 测试缺少必需字段
    invalid_trade = {
        "price": 100,
        "amount": 1
    }
    with pytest.raises(RiskError, match="交易数据缺少必需字段"):
        await risk_manager.check_trade(invalid_trade)
        
    # 测试无效的数值
    invalid_values = {
        "price": -100,
        "amount": 1,
        "type": "buy",
        "portfolio_value": 10000
    }
    with pytest.raises(RiskError, match="价格、数量和投资组合价值必须大于0"):
        await risk_manager.check_trade(invalid_values)
        
    # 测试无效的交易类型
    invalid_type = {
        "price": 100,
        "amount": 1,
        "type": "invalid",
        "portfolio_value": 10000
    }
    with pytest.raises(RiskError, match="交易类型必须是 buy 或 sell"):
        await risk_manager.check_trade(invalid_type)

@pytest.mark.asyncio
async def test_check_trade_limits(risk_manager):
    """测试交易限制"""
    # 设置初始状态
    risk_manager.daily_trades = 0
    risk_manager.daily_loss = 0
    risk_manager.total_exposure = 0
    
    # 有效交易
    valid_trade = {
        "price": 100,
        "amount": 1,
        "type": "buy",
        "portfolio_value": 10000
    }
    result = await risk_manager.check_trade(valid_trade)
    assert result["passed"] is True
    
    # 测试每日交易次数限制
    risk_manager.daily_trades = 30  # 超过high风险等级的限制
    result = await risk_manager.check_trade(valid_trade)
    assert result["passed"] is False
    assert result["checks"]["daily_trades"] is False

@pytest.mark.asyncio
async def test_position_size_calculation(risk_manager):
    """测试仓位计算"""
    portfolio_value = 10000
    risk_per_trade = 0.01  # 1%
    
    size = risk_manager.calculate_position_size(portfolio_value, risk_per_trade)
    assert isinstance(size, float)
    assert size > 0
    assert size <= portfolio_value * 0.15  # 不超过high风险等级的限制

@pytest.mark.asyncio
async def test_risk_metrics(risk_manager):
    """测试风险指标"""
    metrics = await risk_manager.get_risk_metrics()
    assert "daily_loss" in metrics
    assert "daily_trades" in metrics
    assert "total_exposure" in metrics
    assert "risk_level" in metrics
    assert "limits" in metrics
    assert isinstance(metrics["timestamp"], str)

@pytest.mark.asyncio
async def test_risk_level_adjustment(risk_manager):
    """测试风险等级调整"""
    # 测试高收益低波动场景
    high_performance = {
        "daily_return": 0.02,
        "volatility": 0.05,
        "sharpe_ratio": 2.5
    }
    await risk_manager.adjust_risk_level(high_performance)
    assert risk_manager.risk_level == "high"
    
    # 测试低收益高波动场景
    low_performance = {
        "daily_return": -0.01,
        "volatility": 0.25,
        "sharpe_ratio": 0.5
    }
    await risk_manager.adjust_risk_level(low_performance)
    assert risk_manager.risk_level == "low"
