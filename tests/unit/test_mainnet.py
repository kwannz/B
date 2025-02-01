import asyncio
import logging
from solana.rpc.async_api import AsyncClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_mainnet():
    """Test connection to Solana mainnet."""
    client = AsyncClient("https://api.mainnet-beta.solana.com")
    try:
        version = await client.get_version()
        logger.info(f"Successfully connected to Solana mainnet version: {version}")
        await client.close()
        return True
    except Exception as e:
        logger.error(f"Error connecting to mainnet: {e}")
        await client.close()
        return False


if __name__ == "__main__":
    success = asyncio.run(test_mainnet())
    if not success:
        exit(1)
