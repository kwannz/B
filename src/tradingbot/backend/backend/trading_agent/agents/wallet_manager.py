from typing import Optional
import base58
from solders.keypair import Keypair
import httpx


class WalletManager:
    def __init__(self):
        self._client = httpx.AsyncClient(timeout=30.0)
        self._rpc_url = "https://api.mainnet-beta.solana.com"
        self._keypair: Optional[Keypair] = None
        self._public_key: Optional[str] = None
        self._private_key: Optional[str] = None

    def initialize_wallet(self, private_key: Optional[str] = None):
        if not private_key:
            raise ValueError("Private key is required")
            
        try:
            private_key_bytes = base58.b58decode(private_key)
            self._keypair = Keypair.from_bytes(private_key_bytes)
            self._public_key = str(self._keypair.pubkey())
            self._private_key = private_key
        except Exception as e:
            raise ValueError(f"Invalid wallet key format: {str(e)}")

    def get_public_key(self) -> Optional[str]:
        """Get wallet public key"""
        return self._public_key

    def get_private_key(self) -> Optional[str]:
        """Get wallet private key"""
        return self._private_key

    async def get_balance(self) -> float:
        """Get wallet balance in SOL"""
        if not self._keypair:
            return 0.0

        try:
            response = await self._client.post(
                self._rpc_url,
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "getBalance",
                    "params": [str(self._keypair.pubkey())]
                }
            )
            result = response.json()
            if "result" in result and "value" in result["result"]:
                return float(result["result"]["value"]) / 1e9  # Convert lamports to SOL
            return 0.0
        except Exception as e:
            print(f"Error getting balance: {str(e)}")
            return 0.0

    def is_initialized(self) -> bool:
        """Check if wallet is initialized"""
        return self._keypair is not None
