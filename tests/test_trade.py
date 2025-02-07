import asyncio
import aiohttp
import logging
import os
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

import sys
sys.path.append('/home/ubuntu/repos/B/src')
from tradingbot.backend.trading.executor.trade_executor import TradeExecutor

async def execute_test_trade():
    config = {
        "slippage_bps": 100,  # 1% slippage
        "retry_count": 5,
        "retry_delay": 500,
        "max_price_diff": 0.02,
        "circuit_breaker": 0.05,
        "strategy_type": "spot_trading",
        "risk_level": "low",
        "trade_size": 0.01  # Reduced from 0.066 SOL
    }
    
    executor = TradeExecutor(config)
    if not await executor.start():
        logger.error("Failed to start trade executor")
        return
    
    try:
        trade_params = {
            "symbol": "SOL/USDC",
            "type": "MARKET",
            "side": "BUY",
            "amount": 0.066,
            "slippage_tolerance": 2.5,
            "use_go_executor": True,
            "metadata": {
                "test_trade": True,
                "description": "Initial test trade with minimal risk",
                "max_loss_threshold": 5.0,
                "risk_reward_ratio": 2.0,
                "market_conditions_check": True
            }
        }
        
        logger.info("Executing test trade: %s", trade_params)
        result = await executor.execute_trade(trade_params)
        logger.info("Trade execution result: %s", result)
        
        # Monitor trade status
        if result and result.get("id"):
            trade_id = result["id"]
            for _ in range(10):  # Monitor for 50 seconds
                status = await executor.get_trade_status(trade_id)
                logger.info("Trade status: %s", status)
                if status and status.get("status") in ["EXECUTED", "FAILED", "CANCELLED"]:
                    break
                await asyncio.sleep(5)
    finally:
        await executor.stop()

if __name__ == "__main__":
    asyncio.run(execute_test_trade())
