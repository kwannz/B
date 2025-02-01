import os
import sys
import pytest
import asyncio
from datetime import datetime
from pathlib import Path

# 添加项目根目录到Python路径
project_root = str(Path(__file__).parent.parent.parent)
sys.path.append(project_root)

from tradingbot.python.dex.aggregator import DEXAggregator
from tradingbot.python.analysis.ai_analyzer import AIAnalyzer
from tradingbot.python.wallet.manager import WalletManager
from tradingbot.python.risk.manager import RiskManager
from tradingbot.python.strategies.dex_strategy import DEXStrategy


@pytest.fixture
async def dex():
    """创建DEX聚合器实例"""
    dex = DEXAggregator()
    await dex.initialize()
    yield dex
    await dex.close()


@pytest.fixture
async def analyzer():
    """创建AI分析器实例"""
    analyzer = AIAnalyzer()
    await analyzer.initialize()
    yield analyzer
    await analyzer.close()


@pytest.fixture
async def wallet():
    """创建钱包管理器实例"""
    wallet = WalletManager()
    await wallet.initialize()
    yield wallet
    await wallet.close()


@pytest.fixture
async def risk():
    """创建风险管理器实例"""
    risk = RiskManager()
    yield risk


@pytest.fixture
async def strategy():
    """创建交易策略实例"""
    strategy = DEXStrategy()
    await strategy.initialize()
    yield strategy
    await strategy.close()


@pytest.mark.integration
async def test_market_data_flow(dex, analyzer):
    """测试市场数据流"""
    # 1. 获取市场数据
    market_data = await dex.get_market_summary()
    assert market_data is not None
    assert "sol_price" in market_data

    # 2. 分析市场数据
    analysis = await analyzer.analyze_market(market_data)
    assert analysis is not None
    assert "action" in analysis
    assert analysis["action"] in ["buy", "sell", "hold"]
    assert "confidence" in analysis
    assert 0 <= analysis["confidence"] <= 1


@pytest.mark.integration
async def test_wallet_operations(wallet):
    """测试钱包操作"""
    # 1. 创建新钱包
    new_wallet = await wallet.create_wallet()
    assert new_wallet is not None
    assert "public_key" in new_wallet
    assert "private_key" in new_wallet

    # 2. 获取余额
    balance = await wallet.get_balance(new_wallet["public_key"])
    assert isinstance(balance, float)
    assert balance >= 0

    # 3. 获取钱包信息
    info = await wallet.get_wallet_info(new_wallet["public_key"])
    assert info is not None
    assert "balance" in info
    assert "recent_transactions" in info


@pytest.mark.integration
async def test_risk_management(risk):
    """测试风险管理"""
    # 构建测试交易数据
    trade_data = {
        "amount": 1.0,
        "price": 100.0,
        "portfolio_value": 10000.0,
        "stop_loss": 95.0,
        "take_profit": 110.0,
    }

    # 检查风险
    result = await risk.check_trade(trade_data)
    assert result is not None
    assert "passed" in result
    assert "checks" in result
    assert isinstance(result["passed"], bool)


@pytest.mark.integration
async def test_trading_strategy(strategy):
    """测试交易策略"""
    # 1. 分析市场
    analysis = await strategy.analyze_market()
    assert analysis is not None
    assert "market_data" in analysis
    assert "analysis" in analysis
    assert "wallet_info" in analysis

    # 2. 获取策略状态
    status = await strategy.get_status()
    assert status is not None
    assert "initialized" in status
    assert "market_summary" in status
    assert "wallet_info" in status
    assert "risk_metrics" in status


@pytest.mark.integration
async def test_complete_trading_flow(strategy, dex, analyzer, wallet, risk):
    """测试完整的交易流程"""
    # 1. 获取市场数据
    market_data = await dex.get_market_summary()
    assert market_data is not None

    # 2. 分析市场
    analysis = await analyzer.analyze_market(market_data)
    assert analysis is not None

    # 3. 检查钱包状态
    wallet_info = await wallet.get_wallet_info(wallet.wallet_a_address)
    assert wallet_info is not None

    # 4. 构建交易数据
    if analysis["action"] != "hold":
        trade_data = {
            "market_data": market_data,
            "amount": 0.1,  # 测试用小额交易
            "price": market_data["sol_price"],
            "portfolio_value": float(wallet_info["balance"]),
            "side": analysis["action"],
        }

        # 5. 检查风险
        risk_check = await risk.check_trade(trade_data)
        assert risk_check is not None

        if risk_check["passed"]:
            # 6. 执行交易
            trade_result = await strategy.execute_trade(analysis)
            if trade_result:
                assert "status" in trade_result
                assert trade_result["status"] in ["executed", "failed"]


@pytest.mark.integration
async def test_error_handling(strategy, dex, analyzer, wallet, risk):
    """测试错误处理"""
    # 1. 测试无效的市场数据
    analysis = await analyzer.analyze_market({})
    assert analysis is None

    # 2. 测试无效的钱包地址
    balance = await wallet.get_balance("invalid_address")
    assert balance == 0.0

    # 3. 测试无效的交易数据
    risk_check = await risk.check_trade({})
    assert risk_check["passed"] is False

    # 4. 测试策略错误处理
    trade_result = await strategy.execute_trade({})
    assert trade_result is None


@pytest.mark.integration
async def test_performance_metrics():
    """测试性能指标"""
    # 记录开始时间
    start_time = datetime.now()

    # 创建策略实例
    strategy = DEXStrategy()
    await strategy.initialize()

    try:
        # 执行多次市场分析
        for _ in range(5):
            analysis = await strategy.analyze_market()
            assert analysis is not None
            await asyncio.sleep(1)  # 模拟实际间隔

        # 计算执行时间
        execution_time = (datetime.now() - start_time).total_seconds()
        assert execution_time < 30  # 确保性能在可接受范围内

    finally:
        await strategy.close()


if __name__ == "__main__":
    pytest.main(["-v", __file__])
