import asyncio
import base64
import json
import logging
import os
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.system_program import TransferParams, transfer
from solders.transaction import Transaction
from solders.message import Message
from typing import Optional as Some
import aiohttp
import base58

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('solana_integration.log')
    ]
)
logger = logging.getLogger(__name__)

async def verify_solana_integration():
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
            # Test RPC connection
            async with session.post(rpc_url, json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getVersion"
            }) as response:
                if response.status != 200:
                    logger.error(f"Failed to connect to RPC: {response.status}")
                    return False
                    
                data = await response.json()
                if "error" in data:
                    logger.error(f"RPC error: {data['error']}")
                    return False
                    
                version = data["result"]["solana-core"]
                logger.info(f"Connected to Solana {version}")
                
            # Get latest blockhash
            async with session.post(rpc_url, json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getLatestBlockhash",
                "params": [{"commitment": "finalized"}]
            }) as response:
                if response.status != 200:
                    logger.error("Failed to get latest blockhash")
                    return False
                    
                data = await response.json()
                blockhash = data["result"]["value"]["blockhash"]
                logger.info(f"Latest blockhash: {blockhash}")
                
            # Create test transaction (0 SOL transfer to self)
            transfer_ix = transfer(
                TransferParams(
                    from_pubkey=keypair.pubkey(),
                    to_pubkey=keypair.pubkey(),
                    lamports=0
                )
            )
            
            # Create legacy transaction
            instructions = [transfer_ix]
            message = Message.new_with_blockhash(
                instructions,
                keypair.pubkey(),
                blockhash
            )
            transaction = Transaction.new_signed_with_payer(
                instructions,
                keypair.pubkey(),
                [keypair],
                blockhash
            )
            serialized_tx = base64.b64encode(transaction.to_bytes()).decode('utf-8')
            
            # Test transaction simulation
            async with session.post(rpc_url, json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "simulateTransaction",
                "params": [
                    serialized_tx,
                    {"encoding": "base64", "commitment": "processed"}
                ]
            }) as response:
                if response.status != 200:
                    logger.error("Failed to simulate transaction")
                    return False
                    
                data = await response.json()
                if "error" in data:
                    logger.error(f"Transaction simulation failed: {data['error']}")
                    return False
                    
                logger.info("Transaction simulation successful")
                return True
                
    except Exception as e:
        logger.error(f"Solana integration verification failed: {e}")
        return False

if __name__ == "__main__":
    asyncio.run(verify_solana_integration())
