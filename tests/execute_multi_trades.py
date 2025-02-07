import asyncio
import logging
from datetime import datetime
from tradingbot.shared.exchange.multi_token_trader import MultiTokenTrader

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('trading.log')
    ]
)
logger = logging.getLogger(__name__)

async def execute_multi_trades():
    config = {
        "slippage_bps": 250,  # 2.5% slippage
        "retry_count": 3,
        "retry_delay": 1000,
        "max_price_diff": 0.05,
        "circuit_breaker": 0.10,
        "wallet_address": "So11111111111111111111111111111111111111112",
        "update_interval": 300,  # 5 minutes
        "min_daily_volume": 1_000_000,  # $1M minimum volume
        "min_depth_ratio": 0.1  # 10% max price impact
    }
    
    trader = MultiTokenTrader(config)
    if not await trader.start():
        logger.error("Failed to start trader")
        return
    
    try:
        logger.info("Starting multi-token trading")
        trade_results = await trader.execute_trades(amount_per_trade=0.066)
        
        # Log trade results
        for result in trade_results:
            if result["status"] == "executed":
                logger.info(f"Successful trade: {result}")
            else:
                logger.warning(f"Failed trade: {result}")
                
        # Record summary
        summary = {
            "timestamp": datetime.utcnow().isoformat(),
            "total_trades": len(trade_results),
            "successful_trades": len([t for t in trade_results if t["status"] == "executed"]),
            "failed_trades": len([t for t in trade_results if t["status"] == "failed"])
        }
        logger.info(f"Trading summary: {summary}")
        
    except Exception as e:
        logger.error(f"Trading error: {e}")
    finally:
        await trader.stop()

if __name__ == "__main__":
    asyncio.run(execute_multi_trades())
