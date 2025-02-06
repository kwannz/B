import asyncio
import logging
import pytest
from solana.rpc.async_api import AsyncClient
from solders.signature import Signature
from tradingbot.backend.trading_agent.agents.wallet_manager import WalletManager
from tradingbot.shared.exchange.gmgn_client import GMGNClient
from tradingbot.shared.exchange.price_aggregator import PriceAggregator

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@pytest.mark.asyncio
async def test_trade_execution():
    try:
        # Initialize components
        wallet = WalletManager()
        client = AsyncClient("https://api.mainnet-beta.solana.com")
        
        # Initialize price aggregator
        price_aggregator = PriceAggregator({
            "jupiter": {"slippage_bps": 200, "retry_count": 3},
            "solscan": {"api_key": None},
            "max_price_diff": 0.05,
            "circuit_breaker": 0.10
        })
        
        # Initialize trading client
        trading_client = GMGNClient({
            "slippage": "0.5",
            "fee": "0.002",
            "use_anti_mev": True,
            "verify_ssl": False,
            "timeout": 30
        })
        
        await price_aggregator.start()
        await trading_client.start()
        
        try:
            # Get initial balance
            balance = await wallet.get_balance()
            logger.info(f"Initial balance: {balance} SOL")
            
            # Calculate position size (1% of balance)
            position_size = balance * 0.01
            token_in = "So11111111111111111111111111111111111111112"  # SOL
            token_out = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"  # USDC
            
            # Get market data
            market_data = await price_aggregator.get_aggregated_price(
                token_in=token_in,
                token_out=token_out,
                amount=position_size
            )
            
            if "error" in market_data:
                logger.error(f"Market data error: {market_data['error']}")
                return
                
            logger.info(f"Price: {market_data['price']} USDC/SOL")
            logger.info(f"Price difference: {market_data.get('price_diff', 0):.2%}")
            
            # Get quote
            quote = await trading_client.get_quote(
                token_in=token_in,
                token_out=token_out,
                amount=position_size
            )
            
            if "error" in quote:
                logger.error(f"Quote error: {quote['error']}")
                return
                
            # Execute trade
            trade_result = await trading_client.execute_swap(quote, None)
            if "error" in trade_result:
                logger.error(f"Trade error: {trade_result['error']}")
                return
                
            if "signature" not in trade_result:
                logger.error("Trade result missing signature")
                return
                
            # Validate transaction
            signature = trade_result["signature"]
            logger.info(f"Trade signature: {signature}")
            
            from solders.signature import Signature
            try:
                sig = Signature.from_string(signature)
                status = await client.get_signature_statuses([sig])
                if not status.value[0]:
                    logger.error("Transaction validation failed - no status")
                    return
                
                if status.value[0].confirmation_status == "finalized":
                    logger.info("Trade validated successfully")
                    
                    # Get final balance
                    final_balance = await wallet.get_balance()
                    logger.info(f"Final balance: {final_balance} SOL")
                    logger.info(f"Balance change: {final_balance - balance} SOL")
                else:
                    logger.error(f"Transaction validation failed - status: {status.value[0].confirmation_status}")
            except Exception as e:
                logger.error(f"Transaction validation error: {e}")
                return
                # Get final balance
                final_balance = await wallet.get_balance()
                logger.info(f"Final balance: {final_balance} SOL")
                logger.info(f"Balance change: {final_balance - balance} SOL")
            else:
                logger.error(f"Transaction validation failed - status: {status.value[0].confirmation_status}")
                
        finally:
            await trading_client.stop()
            await price_aggregator.stop()
            
    except Exception as e:
        logger.error(f"Test failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_trade_execution())
