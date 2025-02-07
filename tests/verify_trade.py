import asyncio
import logging
from datetime import datetime
from tradingbot.backend.trading.executor.trade_executor import TradeExecutor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def verify_trade_success(trade_id: str = "test_trade_id"):
    config = {
        "slippage_bps": 250,  # 2.5% slippage
        "retry_count": 3,
        "retry_delay": 1000,
        "max_price_diff": 0.05,
        "circuit_breaker": 0.10
    }
    
    executor = TradeExecutor(config)
    if not await executor.start():
        logger.error("Failed to start trade executor")
        return False
    
    try:
        # Get trade status
        status = await executor.get_trade_status(trade_id)
        logger.info("Trade status: %s", status)
        
        if not status or status.get("status") != "EXECUTED":
            logger.error("Trade not executed successfully")
            return False
        
        # Get wallet balance to verify changes
        balance = await executor.wallet_manager.get_balance()
        logger.info("Current wallet balance: %s", balance)
        
        return True
    finally:
        await executor.stop()

if __name__ == "__main__":
    asyncio.run(verify_trade_success())
