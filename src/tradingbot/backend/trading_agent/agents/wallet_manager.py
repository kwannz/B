"""Wallet manager module for Solana wallet operations"""
import os
import base58
from solders.keypair import Keypair
from solana.rpc.async_api import AsyncClient


class WalletManager:
    def __init__(self):
        self._client = AsyncClient("https://api.mainnet-beta.solana.com")
        wallet_key = os.environ.get("SOLANA_WALLET_KEY") or os.environ.get("walletkey")
        if not wallet_key:
            raise ValueError("Wallet key not found in environment variables (SOLANA_WALLET_KEY or walletkey)")
        
        try:
            decoded_key = base58.b58decode(wallet_key)
            if len(decoded_key) != 64:
                raise ValueError("Invalid key length")
                
            self._keypair = Keypair.from_bytes(decoded_key)
            expected_address = "4BKPzFyjBaRP3L1PNDf3xTerJmbbxxESmDmZJ2CZYdQ5"
            if str(self._keypair.pubkey()) != expected_address:
                raise ValueError(f"Invalid wallet address")
                
            self._public_key = str(self._keypair.pubkey())
            self._private_key = wallet_key
        except Exception as e:
            raise ValueError(f"Invalid wallet key: {e}")

    async def get_balance(self) -> float:
        """Get wallet balance"""
        response = await self._client.get_balance(self._keypair.pubkey())
        if response.value is None:
            raise ValueError("Failed to get balance")
        return float(response.value) / 1e9

    def get_public_key(self) -> str:
        """Get wallet public key"""
        return self._public_key

    def get_private_key(self) -> str:
        """Get wallet private key"""
        return self._private_key

    async def send_transaction(self, to_address: str, amount: float) -> str:
        """Send transaction

        Args:
            to_address: Destination address
            amount: Amount to send

        Returns:
            Transaction hash
        """
        balance = await self.get_balance()
        if amount > balance:
            raise ValueError("Insufficient funds")
            
        # Transaction implementation will be added when needed
        raise NotImplementedError("Transaction sending not implemented")

    async def sign_message(self, message: bytes) -> bytes:
        """Sign message with private key

        Args:
            message: Message to sign

        Returns:
            Signature
        """
        return self._keypair.sign_message(message)
