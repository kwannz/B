import asyncio
import logging
import os
from datetime import datetime
import motor.motor_asyncio
from tradingbot.backend.trading_agent.agents.wallet_manager import WalletManager
from tradingbot.shared.exchange.gmgn_client import GMGNClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def execute_trades():
    try:
        # Initialize MongoDB connection
        mongo_client = motor.motor_asyncio.AsyncIOMotorClient(
            os.getenv("MONGODB_URL", "mongodb://localhost:27017"),
            serverSelectionTimeoutMS=5000
        )
        db = mongo_client.tradingbot

        # Initialize wallet and trading client
        wallet = WalletManager()
        trading_client = GMGNClient(
            api_key=os.getenv("GMGN_API_KEY"),
            base_url="https://api.gmgn.ai/v1"
        )

        # Verify wallet balance
        balance = await wallet.get_balance()
        logger.info(f"Current wallet balance: {balance} SOL")

        while True:
            try:
                # Get market data
                market_data = await trading_client.get_market_data()
                
                # Calculate position size (1% of balance)
                position_size = balance * 0.01
                
                # Execute trade with risk management
                trade_result = await trading_client.execute_trade(
                    symbol="SOL/USDC",
                    side="buy",
                    size=position_size,
                    price=market_data["price"]
                )

                # Record trade in database
                await db.trades.insert_one({
                    "symbol": "SOL/USDC",
                    "side": "buy",
                    "size": float(position_size),
                    "price": float(market_data["price"]),
                    "timestamp": datetime.utcnow()
                })

                # Update risk metrics
                await db.risk_metrics.update_one(
                    {"timestamp": {"$gte": datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)}},
                    {
                        "$inc": {
                            "total_exposure": float(position_size * market_data["price"]),
                            "margin_used": float(position_size * market_data["price"] * 0.1)
                        }
                    },
                    upsert=True
                )

                logger.info(f"Trade executed: {trade_result}")
                await asyncio.sleep(60)  # Wait 1 minute between trades

            except Exception as e:
                logger.error(f"Error executing trade: {e}")
                await asyncio.sleep(60)  # Wait before retrying

    except Exception as e:
        logger.error(f"Fatal error in trade execution: {e}")
    finally:
        mongo_client.close()

if __name__ == "__main__":
    asyncio.run(execute_trades())
