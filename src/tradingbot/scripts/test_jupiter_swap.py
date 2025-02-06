import asyncio
import json
import logging
from decimal import Decimal
import sys
sys.path.append('/home/ubuntu/repos/B/src')

from tradingbot.api.services.solana_swap import solana_swap_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def execute_test_swap():
    try:
        logger.info("Getting Jupiter swap quote for USDC to SOL...")
        quote = await solana_swap_service.get_swap_quote(
            input_mint="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  # USDC
            output_mint="So11111111111111111111111111111111111111112",  # SOL
            amount=Decimal("1000000")  # 1 USDC
        )
        
        if quote["success"]:
            logger.info("Quote Response:")
            logger.info(json.dumps(quote['data'], indent=2))
            
            # Save quote response for inspection
            with open('/home/ubuntu/repos/B/quote_response.json', 'w') as f:
                json.dump(quote['data'], f, indent=2)
                
            result = await solana_swap_service.execute_swap(quote)
            
            if result["success"]:
                logger.info("Swap instructions received:")
                logger.info(json.dumps(result["instructions"], indent=2))
                logger.info("\nQuote details:")
                logger.info(json.dumps(result["quote"], indent=2))
            else:
                logger.error(f"Swap execution failed: {result.get('error')}")
                if 'raw_response' in result:
                    logger.error(f"Raw response: {result['raw_response']}")
        else:
            logger.error(f"Failed to get quote: {quote.get('error')}")
            
    except Exception as e:
        logger.exception("Error during swap execution")
    finally:
        await solana_swap_service.close()

if __name__ == "__main__":
    asyncio.run(execute_test_swap())
