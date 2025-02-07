import asyncio
import json
import logging
import os
from solders.keypair import Keypair
import aiohttp
import base58

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('wallet.log')
    ]
)
logger = logging.getLogger(__name__)

async def verify_wallet():
    rpc_url = os.getenv("HELIUS_RPC_URL")
    wallet_key = os.getenv("walletkey")
    
    if not rpc_url or not wallet_key:
        logger.error("Missing required environment variables")
        return False
        
    try:
        # Initialize wallet
        keypair = Keypair.from_bytes(base58.b58decode(wallet_key))
        pubkey = str(keypair.pubkey())
        
        async with aiohttp.ClientSession() as session:
            # Check wallet balance
            async with session.post(rpc_url, json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getBalance",
                "params": [pubkey]
            }) as response:
                if response.status != 200:
                    logger.error(f"Failed to get balance: {response.status}")
                    return False
                    
                data = await response.json()
                if "error" in data:
                    logger.error(f"RPC error: {data['error']}")
                    return False
                    
                balance = data["result"]["value"] / 1e9  # Convert lamports to SOL
                logger.info(f"Wallet balance: {balance:.6f} SOL")
                
                if balance < 0.5:
                    logger.error(f"Insufficient balance: {balance:.6f} SOL (minimum 0.5 SOL required)")
                    return False
                    
            # Verify account permissions
            async with session.post(rpc_url, json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getAccountInfo",
                "params": [pubkey, {"encoding": "jsonParsed"}]
            }) as response:
                if response.status != 200:
                    logger.error(f"Failed to get account info: {response.status}")
                    return False
                    
                data = await response.json()
                if "error" in data:
                    logger.error(f"RPC error: {data['error']}")
                    return False
                    
                logger.info(f"Account verified: {pubkey}")
                return True
                
    except Exception as e:
        logger.error(f"Wallet verification failed: {e}")
        return False

if __name__ == "__main__":
    asyncio.run(verify_wallet())
