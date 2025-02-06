import asyncio
import logging
import os
from datetime import datetime
import motor.motor_asyncio
import base58
from solders.keypair import Keypair
from tradingbot.backend.trading_agent.agents.wallet_manager import WalletManager
from tradingbot.shared.exchange.gmgn_client import GMGNClient
from tradingbot.shared.exchange.jupiter_client import JupiterClient
from tradingbot.shared.exchange.solscan_client import SolscanClient
from tradingbot.shared.exchange.price_aggregator import PriceAggregator
from solana.rpc.async_api import AsyncClient

from solders.signature import Signature

async def validate_transaction(client: AsyncClient, signature: str, max_retries: int = 10) -> bool:
    """Validate a Solana transaction has been finalized
    
    Args:
        client: Solana RPC client
        signature: Transaction signature string
        max_retries: Maximum number of status check retries
        
    Returns:
        bool: True if transaction is finalized, False otherwise
    """
    retry_count = max_retries
    sig = Signature.from_string(signature)
    
    while retry_count > 0:
        try:
            status = await client.get_signature_statuses([sig])
            if not status.value[0]:
                retry_count -= 1
                if retry_count > 0:
                    await asyncio.sleep(2)  # Wait longer between retries
                continue
                
            if status.value[0].confirmation_status == "finalized":
                return True
                
            retry_count -= 1
            if retry_count > 0:
                await asyncio.sleep(2)
            continue
                
        except Exception as e:
            logging.error(f"Transaction validation error: {e}")
            retry_count -= 1
            if retry_count > 0:
                await asyncio.sleep(2)
            continue
            
    return False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def execute_trades():
    try:
        # Initialize MongoDB and Solana RPC clients
        mongo_client = motor.motor_asyncio.AsyncIOMotorClient(
            os.getenv("MONGODB_URL", "mongodb://localhost:27017"),
            serverSelectionTimeoutMS=5000
        )
        db = mongo_client.tradingbot
        client = AsyncClient("https://api.mainnet-beta.solana.com")

        # Initialize wallet and verify key
        try:
            key = os.environ.get("walletkey")
            if not key:
                logger.error("Wallet key not set")
                return
                
            # Initialize wallet with key
            wallet = WalletManager()
            address = str(wallet._keypair.pubkey())
            logger.info(f"Trading with wallet address: {address}")
            
            # Verify key format and address
            if address != "4BKPzFyjBaRP3L1PNDf3xTerJmbbxxESmDmZJ2CZYdQ5":
                logger.error("Invalid wallet address")
                return
            if not key or len(key) < 64:  # Base58 encoded private key length
                logger.error("Invalid wallet key format")
                return
                
            wallet = WalletManager()
            balance = await wallet.get_balance()
            if balance <= 0:
                logger.error("Wallet has zero balance")
                return
                
            logger.info(f"Wallet initialized successfully. Balance: {balance} SOL")
        except Exception as e:
            logger.error(f"Failed to initialize wallet: {e}")
            return

        # Initialize price aggregator for market data
        price_aggregator = PriceAggregator({
            "jupiter": {
                "slippage_bps": 200,  # 2% slippage
                "retry_count": 3,
                "retry_delay": 1000
            },
            "solscan": {
                "api_key": os.getenv("SOLSCAN_API_KEY")
            },
            "max_price_diff": 0.05,
            "circuit_breaker": 0.10
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
            await price_aggregator.start()
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
                    
                    # Get aggregated market data
                    market_data = await price_aggregator.get_aggregated_price(
                        token_in=token_in,
                        token_out=token_out,
                        amount=position_size
                    )
                    
                    if "error" in market_data:
                        logger.error(f"Failed to get market data: {market_data['error']}")
                        if "Circuit breaker triggered" in market_data.get("error", ""):
                            logger.error(f"Price difference: {market_data.get('price_diff', 0):.2%}")
                            logger.error(f"Jupiter: {market_data.get('jupiter_price', 0)}, Solscan: {market_data.get('solscan_price', 0)}")
                            await asyncio.sleep(300)  # Wait longer for price stabilization
                        else:
                            await asyncio.sleep(60)
                        continue
                        
                    if market_data.get("price_diff", 0) > 0.05:
                        logger.warning(f"Large price difference detected: {market_data['price_diff']:.2%}")
                        logger.warning(f"Jupiter: {market_data['price']}, Solscan: {market_data['validation_price']}")
                        
                    quote = market_data["quote"]
                        
                    # Use validated price from aggregator
                    price = market_data["price"]
                    logger.info(f"Using validated price: {price} USDC/SOL (diff: {market_data.get('price_diff', 0):.2%})")
                    
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
                            # Execute trade with anti-MEV protection
                            trade_result = await trading_client.execute_swap(
                                quote,
                                None  # Use default options from GMGN client
                            )
                            
                            if "error" in trade_result:
                                logger.error(f"Trade error: {trade_result['error']}")
                                retry_count -= 1
                                if retry_count > 0:
                                    logger.warning(f"Retrying trade execution. Attempts left: {retry_count}")
                                    await asyncio.sleep(current_delay / 1000)
                                    current_delay = min(current_delay * 1.5, 5000)
                                continue
                                
                            if "signature" not in trade_result:
                                logger.error("Trade result missing signature")
                                retry_count -= 1
                                if retry_count > 0:
                                    await asyncio.sleep(current_delay / 1000)
                                    current_delay = min(current_delay * 1.5, 5000)
                                continue
                                
                            # Validate transaction
                            if await validate_transaction(client, trade_result["signature"]):
                                logger.info(f"Trade validated successfully: {trade_result['signature']}")
                                break
                            else:
                                logger.error(f"Transaction validation failed: {trade_result['signature']}")
                                retry_count -= 1
                                if retry_count > 0:
                                    await asyncio.sleep(current_delay / 1000)
                                    current_delay = min(current_delay * 1.5, 5000)
                                continue
                            
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
        if price_aggregator:
            await price_aggregator.stop()
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
