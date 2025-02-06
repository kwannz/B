import asyncio
import aiohttp
import json

async def get_quote():
    url = 'https://quote-api.jup.ag/v6/quote'
    params = {
        'inputMint': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        'outputMint': 'So11111111111111111111111111111111111111112',
        'amount': '1000000',
        'slippageBps': '50'
    }
    async with aiohttp.ClientSession() as session:
        async with session.get(url, params=params) as response:
            data = await response.json()
            print(json.dumps(data, indent=2))

if __name__ == "__main__":
    asyncio.run(get_quote())
