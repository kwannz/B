"""Script to verify Solana SDK installation and functionality."""
import logging
from solana.keypair import Keypair
from solana.rpc.async_api import AsyncClient
import asyncio

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def verify_solana_sdk():
    """Verify Solana SDK functionality."""
    try:
        # Test keypair generation
        keypair = Keypair()
        logger.info(f"Generated keypair with public key: {keypair.public_key}")
        
        # Test RPC connection
        client = AsyncClient("https://api.mainnet-beta.solana.com")
        response = await client.get_version()
        logger.info(f"Connected to Solana mainnet: {response}")
        await client.close()
        
        return True
    except Exception as e:
        logger.error(f"Solana SDK verification failed: {str(e)}")
        return False

if __name__ == "__main__":
    success = asyncio.run(verify_solana_sdk())
    if not success:
        exit(1)
