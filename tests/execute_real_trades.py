import os
import asyncio
import logging
import pytest
from decimal import Decimal
from typing import Dict, Any

from tradingbot.shared.exchange.gmgn_client import GMGNClient
from tradingbot.backend.backend.trading_agent.agents.wallet_manager import WalletManager

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def execute_trades():
    """Execute real-time trades on GMGN."""
    # Initialize wallet
    wallet_manager = WalletManager()
    wallet_manager.initialize_wallet(os.environ.get("walletkey"))
    logger.info(f"Initialized wallet with public key: {wallet_manager.get_public_key()}")
    
    # Configure GMGN client
    config = {
        "slippage": "0.5",  # 0.5% slippage tolerance
        "fee": "0.002",     # 0.2% fee
        "use_anti_mev": True
    }
    client = GMGNClient(config)
    await client.start()
    
    # Trading parameters
    token_in = "So11111111111111111111111111111111111111112"  # SOL
    token_out = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"  # USDC
    amount = 0.001  # Small trade size for testing
    
    try:
        # Get quote
        quote = await client.get_quote(token_in, token_out, amount)
        if "error" in quote:
            logger.error(f"Failed to get quote: {quote['error']}")
            return
            
        # Execute swap
        result = await client.execute_swap(quote, None)
        if "error" in result and "response" not in result:
            logger.error(f"Failed to execute swap: {result['error']}")
            return
            
        if "data" in result and "tx_hash" in result["data"]:
            tx_hash = result["data"]["tx_hash"]
            logger.info(f"Transaction submitted successfully!")
            logger.info(f"Transaction hash: {tx_hash}")
            logger.info(f"Solscan link: https://solscan.io/tx/{tx_hash}")
        else:
            logger.error("Invalid response format")
            logger.error(f"Response: {result}")
            return
        logger.info(f"Transaction submitted: {tx_hash}")
        logger.info(f"Solscan link: https://solscan.io/tx/{tx_hash}")
        
        # Monitor transaction status
        while True:
            status = await client.get_transaction_status(
                tx_hash,
                quote["data"]["raw_tx"]["lastValidBlockHeight"]
            )
            if status["data"]["success"]:
                logger.info("Transaction confirmed!")
                break
            elif status["data"]["expired"]:
                logger.error("Transaction expired")
                break
            await asyncio.sleep(1)
            
    except Exception as e:
        logger.error(f"Error executing trade: {str(e)}")
    finally:
        await client.stop()

@pytest.mark.asyncio
@pytest.mark.asyncio
async def test_execute_trades():
    """Test GMGN trade execution."""
    try:
        await asyncio.wait_for(execute_trades(), timeout=30)  # 30 second timeout
    except asyncio.TimeoutError:
        pytest.fail("Test timed out after 30 seconds")
    except Exception as e:
        pytest.fail(f"Test failed with error: {str(e)}")
