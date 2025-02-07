import asyncio
import logging
from datetime import datetime
from tradingbot.backend.trading.executor.trade_executor import TradeExecutor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def record_trade_metrics(trade_id: str = "test_trade_id"):
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
        return
    
    try:
        # Get trade status and metrics
        status = await executor.get_trade_status(trade_id)
        if not status:
            logger.error("Failed to get trade status")
            return
            
        # Record execution metrics
        metrics = {
            "trade_id": trade_id,
            "execution_time": status.get("timestamp"),
            "status": status.get("status"),
            "slippage_bps": config["slippage_bps"],
            "price_impact": 0.025,  # 2.5% for test trade
            "gas_costs": 0.000005,  # Example gas cost in SOL
            "ai_validation": {
                "risk_level": 0.5,
                "market_conditions": 0.75,
                "risk_reward_ratio": 2.0
            }
        }
        
        logger.info("Trade Metrics:")
        logger.info("- Execution Time: %s", metrics["execution_time"])
        logger.info("- Status: %s", metrics["status"])
        logger.info("- Slippage (bps): %s", metrics["slippage_bps"])
        logger.info("- Price Impact: %.2f%%", metrics["price_impact"] * 100)
        logger.info("- Gas Costs: %.6f SOL", metrics["gas_costs"])
        logger.info("AI Validation Metrics:")
        logger.info("- Risk Level: %.2f", metrics["ai_validation"]["risk_level"])
        logger.info("- Market Conditions: %.2f", metrics["ai_validation"]["market_conditions"])
        logger.info("- Risk/Reward Ratio: %.2f", metrics["ai_validation"]["risk_reward_ratio"])
        
        return metrics
    finally:
        await executor.stop()

if __name__ == "__main__":
    asyncio.run(record_trade_metrics())
