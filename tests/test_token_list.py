import aiohttp
import asyncio
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def main():
    async with aiohttp.ClientSession() as session:
        response = await session.get('https://token.jup.ag/all')
        data = await response.json()
        logger.info(f'Raw response type: {type(data)}')
        if isinstance(data, dict) and 'tokens' in data:
            tokens = data['tokens']
        else:
            tokens = data
        logger.info(f'Total tokens: {len(tokens)}')
        logger.info('First 3 tokens:')
        for token in tokens[:3]:
            logger.info(f'Token data: {json.dumps(token, indent=2)}')

if __name__ == '__main__':
    asyncio.run(main())
