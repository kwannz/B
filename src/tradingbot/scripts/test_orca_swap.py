import asyncio
import json
import logging
from decimal import Decimal
import sys
sys.path.append('/home/ubuntu/repos/B/src')

from tradingbot.api.services.orca_swap import orca_swap_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def execute_test_swap():
    try:
        logger.info("Getting Orca swap quote for USDC to SOL...")
        quote = await orca_swap_service.get_swap_quote(
            input_mint="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            output_mint="So11111111111111111111111111111111111111112",
            amount=Decimal("1000000")
        )
        
        if quote["success"]:
            logger.info(f"Quote received: {json.dumps(quote['data'], indent=2)}")
            result = await orca_swap_service.execute_swap(quote)
            
            if result["success"]:
                logger.info(f"Swap executed successfully: {json.dumps(result, indent=2)}")
                print(f"Transaction ID: {result.get('transaction_id')}")
            else:
                logger.error(f"Swap execution failed: {result.get('error')}")
        else:
            logger.error(f"Failed to get quote: {quote.get('error')}")
            
    except Exception as e:
        logger.exception("Error during swap execution")
    finally:
        await orca_swap_service.close()

if __name__ == "__main__":
    asyncio.run(execute_test_swap())
