import os
import logging
from typing import Optional
from solders.keypair import Keypair
from solders.pubkey import Pubkey
import base58
import aiohttp

logger = logging.getLogger(__name__)

class WalletManager:
    def __init__(self):
        self._initialized = False
        self._wallet_key = os.getenv("walletkey")
        self._rpc_url = os.getenv("HELIUS_RPC_URL")
        self._session = None
        self._wallet = None
        
    async def initialize(self) -> bool:
        try:
            if not self._wallet_key or not self._rpc_url:
                logger.error("Missing required environment variables")
                return False
                
            self._wallet = Keypair.from_bytes(base58.b58decode(self._wallet_key))
            self._session = aiohttp.ClientSession()
            self._initialized = True
            
            # Verify balance
            balance = await self.get_balance()
            logger.info(f"Initialized wallet with balance: {balance:.6f} SOL")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize wallet: {e}")
            self._initialized = False
            return False
            
    @property
    def is_initialized(self) -> bool:
        return self._initialized
        
    def get_private_key(self) -> Optional[str]:
        return self._wallet_key if self._initialized else None
        
    async def get_balance(self) -> float:
        if not self._initialized or not self._session:
            return 0.0
            
        try:
            async with self._session.post(
                self._rpc_url,
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "getBalance",
                    "params": [str(self._wallet.pubkey())]
                }
            ) as response:
                if response.status != 200:
                    logger.error(f"Failed to get balance: {response.status}")
                    return 0.0
                    
                data = await response.json()
                if "error" in data:
                    logger.error(f"RPC error: {data['error']}")
                    return 0.0
                    
                return data["result"]["value"] / 1e9  # Convert lamports to SOL
                
        except Exception as e:
            logger.error(f"Failed to get balance: {e}")
            return 0.0
            
    def get_public_key(self) -> Optional[Pubkey]:
        if not self._initialized or not self._wallet:
            return None
        return self._wallet.pubkey()
        
    async def stop(self):
        if self._session:
            await self._session.close()
            self._session = None
