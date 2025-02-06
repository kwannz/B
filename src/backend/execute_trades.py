import asyncio
import logging
import os
from datetime import datetime
import motor.motor_asyncio
from tradingbot.backend.trading_agent.agents.wallet_manager import WalletManager
from tradingbot.shared.exchange.gmgn_client import GMGNClient
from tradingbot.shared.exchange.jupiter_client import JupiterClient

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

        # Initialize Jupiter client for market data
        jupiter_client = JupiterClient({
            "slippage_bps": 200,  # 2% slippage
            "retry_count": 3,
            "retry_delay": 1000,  # 1s initial delay
            "min_success_rate": 0.8
        })
        
        # Initialize GMGN client for trading execution
        trading_client = GMGNClient({
            "slippage": "0.5",
            "fee": "0.002",
            "use_anti_mev": True,
            "verify_ssl": False,
            "timeout": 30,
            "cf_retry_count": 5,
            "cf_retry_delay": 3
        })
        
        try:
            await jupiter_client.start()
            await trading_client.start()
            logger.info("Trading clients initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize trading clients: {e}")
            return

        # Verify initial balance and set trading limits
        min_balance = 0.01  # Minimum 0.01 SOL required
        if balance < min_balance:
            logger.error(f"Insufficient balance: {balance} SOL (minimum required: {min_balance} SOL)")
            return
            
        # Set position size to 10% of balance for smaller trades
        max_position_size = balance * 0.1
        
        logger.info("Trading system initialized successfully")

        while True:
            try:
                try:
                    # Calculate position size (1% of balance)
                    position_size = min(max_position_size, balance * 0.01)  # Use smaller of max size or 1% of balance
                    token_in = "So11111111111111111111111111111111111111112"  # SOL token address
                    token_out = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"  # USDC token address
                    
                    # Get market data from Jupiter API
                    market_data = await jupiter_client.get_quote(
                        input_mint=token_in,
                        output_mint=token_out,
                        amount=int(position_size * 1e9)  # Convert SOL to lamports
                    )
                    if "error" in market_data:
                        logger.error(f"Failed to get market data from Jupiter: {market_data['error']}")
                        await asyncio.sleep(60)
                        continue
                        
                    # Calculate price from Jupiter quote
                    price = float(market_data["outAmount"]) / (float(market_data["inAmount"]) * 1e3)  # Convert to USDC/SOL
                    logger.info(f"Got price from Jupiter: {price} USDC/SOL")
                    
                    # Get quote for the trade with retry logic
                    retry_count = 3
                    while retry_count > 0:
                        quote = await trading_client.get_quote(
                            token_in=token_in,
                            token_out=token_out,
                            amount=position_size
                        )
                        if "error" not in quote:
                            break
                        retry_count -= 1
                        if retry_count > 0:
                            await asyncio.sleep(5)  # Wait before retry
                    if "error" in quote:
                        logger.error(f"Failed to get quote: {quote['error']}")
                        await asyncio.sleep(60)  # Wait before retrying
                        continue

                    # Execute the swap with anti-MEV protection and retry logic
                    retry_count = 3
                    current_delay = 1000  # Start with 1s delay
                    while retry_count > 0:
                        try:
                            trade_result = await trading_client.execute_swap(
                                quote,
                                {
                                    "skip_preflight": True,
                                    "max_retries": 3,
                                    "skip_confirmation": False,
                                    "commitment": "confirmed"
                                }
                            )
                            
                            if "error" not in trade_result:
                                if "signature" in trade_result:
                                    logger.info(f"Trade executed successfully: {trade_result['signature']}")
                                    break
                                else:
                                    logger.error("Trade result missing signature")
                            else:
                                logger.error(f"Trade error: {trade_result['error']}")
                                
                            retry_count -= 1
                            if retry_count > 0:
                                logger.warning(f"Retrying trade execution. Attempts left: {retry_count}")
                                await asyncio.sleep(current_delay / 1000)
                                current_delay = min(current_delay * 1.5, 5000)  # Max 5s delay
                            else:
                                logger.error(f"Failed to execute trade after all retries: {trade_result.get('error', 'Unknown error')}")
                                continue
                                
                        except Exception as e:
                            logger.error(f"Trade execution error: {str(e)}")
                            retry_count -= 1
                            if retry_count > 0:
                                await asyncio.sleep(current_delay / 1000)
                                current_delay = min(current_delay * 1.5, 5000)
                            else:
                                logger.error("Failed to execute trade after all retries")
                                continue

                    # Update balance after successful trade
                    balance = await wallet.get_balance()
                    logger.info(f"Updated wallet balance: {balance} SOL")
                except Exception as e:
                    logger.error(f"Error during trade execution: {e}")
                    await asyncio.sleep(30)  # Shorter wait time for retries
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
        if jupiter_client:
            await jupiter_client.stop()
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
