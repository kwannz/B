import asyncio
import json
import logging
import os
from solders.keypair import Keypair
import aiohttp
import base58
import time

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('balance_monitor.log')
    ]
)
logger = logging.getLogger(__name__)

async def monitor_balance():
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
            while True:
                try:
                    # Check wallet balance
                    async with session.post(rpc_url, json={
                        "jsonrpc": "2.0",
                        "id": 1,
                        "method": "getBalance",
                        "params": [pubkey]
                    }) as response:
                        if response.status != 200:
                            logger.error(f"Failed to get balance: {response.status}")
                            continue
                            
                        data = await response.json()
                        if "error" in data:
                            logger.error(f"RPC error: {data['error']}")
                            continue
                            
                        balance = data["result"]["value"] / 1e9  # Convert lamports to SOL
                        logger.info(f"Current balance: {balance:.6f} SOL")
                        
                        # Log balance metrics
                        with open("balance_metrics.log", "a") as f:
                            f.write(f"{time.time()},{balance:.6f}\n")
                        
                        if balance < 0.5:
                            logger.warning(f"Low balance warning: {balance:.6f} SOL (minimum 0.5 SOL required)")
                            
                except Exception as e:
                    logger.error(f"Balance check failed: {e}")
                    
                await asyncio.sleep(5)  # Check every 5 seconds
                    
    except Exception as e:
        logger.error(f"Balance monitoring failed: {e}")
        return False

if __name__ == "__main__":
    asyncio.run(monitor_balance())
