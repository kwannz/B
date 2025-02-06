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

        # Initialize wallet and verify key
        try:
            wallet = WalletManager()
            balance = await wallet.get_balance()
            logger.info(f"Wallet initialized successfully. Balance: {balance} SOL")
        except Exception as e:
            logger.error(f"Failed to initialize wallet: {e}")
            return

        # Initialize trading client with proper configuration
        trading_client = GMGNClient({
            "slippage": "0.5",
            "fee": "0.002",
            "use_anti_mev": True,
            "verify_ssl": False,
            "timeout": 30
        })
        
        try:
            await trading_client.start()
            logger.info("Trading client initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize trading client: {e}")
            return

        # Verify initial balance and set trading limits
        min_balance = 0.1  # Minimum 0.1 SOL required
        if balance < min_balance:
            logger.error(f"Insufficient balance: {balance} SOL (minimum required: {min_balance} SOL)")
            return
        
        logger.info("Trading system initialized successfully")

        while True:
            try:
                # Get market data
                market_data = await trading_client.get_market_data()
                
                # Calculate position size (1% of balance)
                position_size = balance * 0.01
                
                try:
                    # Get market data and execute trade
                    market_data = await trading_client.get_market_data()
                    if "error" in market_data:
                        logger.error(f"Failed to get market data: {market_data['error']}")
                        await asyncio.sleep(60)  # Wait before retrying
                        continue

                    # Calculate trade parameters
                    token_in = "So11111111111111111111111111111111111111112"  # SOL token address
                    token_out = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"  # USDC token address
                    
                    # Get quote for the trade
                    quote = await trading_client.get_quote(
                        token_in=token_in,
                        token_out=token_out,
                        amount=position_size
                    )
                    if "error" in quote:
                        logger.error(f"Failed to get quote: {quote['error']}")
                        await asyncio.sleep(60)  # Wait before retrying
                        continue

                    # Execute the swap with anti-MEV protection
                    trade_result = await trading_client.execute_swap(quote, None)
                    if "error" in trade_result:
                        logger.error(f"Failed to execute trade: {trade_result['error']}")
                        await asyncio.sleep(60)  # Wait before retrying
                        continue

                    logger.info(f"Trade executed successfully: {trade_result}")
                except Exception as e:
                    logger.error(f"Error during trade execution: {e}")
                    await asyncio.sleep(60)  # Wait before retrying
                    continue

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
        if trading_client:
            await trading_client.stop()
        mongo_client.close()
        logger.info("Trade execution stopped, resources cleaned up")

if __name__ == "__main__":
    try:
        asyncio.run(execute_trades())
    except KeyboardInterrupt:
        logger.info("Trade execution interrupted by user")
    except Exception as e:
        logger.error(f"Unexpected error in trade execution: {e}")
    finally:
        logger.info("Trade execution process terminated")
