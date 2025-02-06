import asyncio
import aiohttp
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def check_cloudflare():
    headers = {
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive',
        'Origin': 'https://gmgn.ai',
        'Referer': 'https://gmgn.ai/',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
    }
    
    async with aiohttp.ClientSession(headers=headers) as session:
        urls = [
            'https://gmgn.ai/defi/router/v1/sol/market',
            'https://gmgn.ai/defi/router/v1/sol/tx/get_swap_route',
            'https://gmgn.ai/defi/router/v1/sol/tx/get_transaction_status'
        ]
        
        for url in urls:
            try:
                logger.info(f"Testing URL: {url}")
                async with session.get(url, ssl=False) as response:
                    logger.info(f"Status: {response.status}")
                    logger.info("CloudFlare Headers:")
                    for k, v in response.headers.items():
                        if k.lower().startswith('cf-'):
                            logger.info(f"{k}: {v}")
                    
                    body = await response.text()
                    if "cf-" in body.lower():
                        logger.info("CloudFlare Challenge detected in response body")
                    
                    await asyncio.sleep(2)  # Avoid rate limiting
            except Exception as e:
                logger.error(f"Error testing {url}: {e}")

if __name__ == "__main__":
    asyncio.run(check_cloudflare())
