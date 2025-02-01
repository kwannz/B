from typing import Optional
from solana.rpc.async_api import AsyncClient
from solders.keypair import Keypair
from base58 import b58encode, b58decode


class WalletManager:
    def __init__(self):
        self.client = AsyncClient("https://api.testnet.solana.com")
        self._keypair: Optional[Keypair] = None
        self._public_key: Optional[str] = None
        self._private_key: Optional[str] = None

    def initialize_wallet(self, private_key: str = None):
        """Initialize wallet with existing private key or generate new one"""
        if private_key:
            # Convert private key from base58 to bytes
            private_key_bytes = b58decode(private_key)
            self._keypair = Keypair.from_secret_key(private_key_bytes)
        else:
            self._keypair = Keypair()

        self._public_key = str(self._keypair.public_key)
        self._private_key = b58encode(self._keypair.secret_key).decode("utf-8")

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
            response = await self.client.get_balance(self._keypair.public_key)
            if response.value is None:
                return 0.0
            return float(response.value) / 1e9  # Convert lamports to SOL
        except Exception as e:
            print(f"Error getting balance: {str(e)}")
            return 0.0

    def is_initialized(self) -> bool:
        """Check if wallet is initialized"""
        return self._keypair is not None
