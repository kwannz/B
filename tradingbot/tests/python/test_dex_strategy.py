import pytest
import asyncio
from tradingbot.trading_agent.python.strategies.dex_strategy import DEXStrategy, AIAnalyzer
from tradingbot.python.dex.jupiter import JupiterDEX
from tradingbot.python.dex.raydium import RaydiumDEX
from tradingbot.python.dex.orca import OrcaDEX


@pytest.fixture
def strategy():
    return DEXStrategy()


@pytest.mark.asyncio
async def test_market_analysis(strategy):
    """测试市场分析功能"""
    market_data = await strategy.analyze_market()
    assert market_data is not None
    assert "price" in market_data
    assert "route" in market_data
    assert "analysis" in market_data


@pytest.mark.asyncio
async def test_jupiter_dex():
    """测试Jupiter DEX接口"""
    dex = JupiterDEX()

    # 测试获取报价
    quote = await dex.get_quote(
        input_mint="So11111111111111111111111111111111111111112",  # SOL
        output_mint="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  # USDC
        amount="1000000000",  # 1 SOL
    )
    assert quote is not None
    assert "outAmount" in quote

    # 测试获取路由
    routes = await dex.get_routes(
        input_mint="So11111111111111111111111111111111111111112",
        output_mint="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount="1000000000",
    )
    assert routes is not None
    assert len(routes) > 0


@pytest.mark.asyncio
async def test_raydium_dex():
    """测试Raydium DEX接口"""
    dex = RaydiumDEX()

    # 测试获取报价
    quote = await dex.get_quote(
        input_mint="So11111111111111111111111111111111111111112",
        output_mint="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount="1000000000",
    )
    assert quote is not None
    assert "outAmount" in quote


@pytest.mark.asyncio
async def test_orca_dex():
    """测试Orca DEX接口"""
    dex = OrcaDEX()

    # 测试获取报价
    quote = await dex.get_quote(
        input_mint="So11111111111111111111111111111111111111112",
        output_mint="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount="1000000000",
    )
    assert quote is not None
    assert "outAmount" in quote


@pytest.mark.asyncio
async def test_price_comparison(strategy):
    """测试价格比较功能"""
    # 获取所有DEX的报价
    quotes = await asyncio.gather(
        strategy.jupiter.get_quote(
            input_mint="So11111111111111111111111111111111111111112",
            output_mint="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            amount="1000000000",
        ),
        strategy.raydium.get_quote(
            input_mint="So11111111111111111111111111111111111111112",
            output_mint="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            amount="1000000000",
        ),
        strategy.orca.get_quote(
            input_mint="So11111111111111111111111111111111111111112",
            output_mint="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            amount="1000000000",
        ),
    )

    # 验证至少有一个报价
    assert any(quote is not None for quote in quotes)

    # 比较价格
    prices = [float(quote["outAmount"]) / 1e6 for quote in quotes if quote]
    assert len(prices) > 0
    assert max(prices) - min(prices) < 10  # 价差不超过10 USDC


@pytest.mark.asyncio
async def test_trade_execution(strategy):
    """测试交易执行"""
    # 获取市场数据
    market_data = await strategy.analyze_market()
    assert market_data is not None

    # 执行交易
    success = await strategy.execute_trade(market_data)
    assert success is True


if __name__ == "__main__":
    pytest.main(["-v"])
