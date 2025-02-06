from typing import Optional
import base58
from solders.keypair import Keypair
from solders.transaction import Transaction
from solders.message import Message
from solders.signature import Signature
from solana.rpc.commitment import Confirmed
from solana.rpc.api import Client
from solana.rpc.types import TxOpts
from solders.pubkey import Pubkey
from solders.instruction import Instruction
from solders.hash import Hash
from solders.system_program import ID as SYS_PROGRAM_ID
import httpx


class WalletManager:
    def __init__(self):
        self._rpc_url = "https://api.mainnet-beta.solana.com"
        self._client = Client(self._rpc_url, commitment=Confirmed)
        self._http_client = httpx.AsyncClient(timeout=30.0)
        self._keypair: Optional[Keypair] = None
        self._public_key: Optional[str] = None
        self._private_key: Optional[str] = None

    def initialize_wallet(self, private_key: Optional[str] = None):
        if not private_key:
            raise ValueError("Private key is required")
            
        try:
            private_key_bytes = base58.b58decode(private_key)
            if len(private_key_bytes) < 32:
                raise ValueError(f"Invalid private key length: {len(private_key_bytes)}, expected at least 32")
            
            # Create keypair from first 32 bytes as seed
            seed = private_key_bytes[:32]
            self._keypair = Keypair.from_seed(seed)
            if not self._keypair:
                raise ValueError("Failed to create keypair from seed")
                
            self._public_key = str(self._keypair.pubkey())
            self._private_key = private_key
            
            print(f"Initialized wallet with public key: {self._public_key}")
            print(f"Wallet type: {type(self._keypair)}")
            print(f"Available methods: {dir(self._keypair)}")
            print(f"Signature methods: {[m for m in dir(self._keypair) if 'sign' in m]}")
            print(f"Seed length: {len(seed)}")
        except Exception as e:
            print(f"Error initializing wallet: {str(e)}")
            print(f"Private key length: {len(private_key_bytes)}")
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
            response = self._client.get_balance(self._keypair.public_key())
            if "result" in response and "value" in response["result"]:
                return float(response["result"]["value"]) / 1e9  # Convert lamports to SOL
            return 0.0
        except Exception as e:
            print(f"Error getting balance: {str(e)}")
            return 0.0

    def sign_message(self, message: bytes) -> bytes:
        """Sign a message with the wallet keypair"""
        if not self._keypair:
            raise ValueError("Wallet not initialized")
        signature = self._keypair.sign_message(message)
        return bytes(signature)

    def sign_transaction(self, transaction_data: str) -> str:
        """Sign a transaction with the wallet keypair"""
        if not self._keypair:
            raise ValueError("Wallet not initialized")
            
        try:
            tx_bytes = base58.b58decode(transaction_data)
            message = Message.from_bytes(tx_bytes)
            message_bytes = bytes(message)
            hash_bytes = bytes(Hash.hash(message_bytes))
            signature = self._keypair.sign(hash_bytes)
            transaction = Transaction(message=message, signatures=[signature])
            print(f"Signing transaction with keypair: {type(self._keypair)}")
            print(f"Message bytes: {message_bytes.hex()}")
            print(f"Hash bytes: {hash_bytes.hex()}")
            print(f"Signature: {bytes(signature).hex()}")
            print(f"Transaction: {base58.b58encode(bytes(transaction)).decode('utf-8')}")
            return base58.b58encode(bytes(transaction)).decode('utf-8')
        except Exception as e:
            print(f"Error details: {str(e)}")
            print(f"Message bytes: {message_bytes.hex()}")
            print(f"Keypair type: {type(self._keypair)}")
            print(f"Available methods: {dir(self._keypair)}")
            print(f"Signature methods: {[m for m in dir(self._keypair) if 'sign' in m]}")
            print(f"Message hash: {Hash.hash(message_bytes).hex()}")
            raise ValueError(f"Failed to sign transaction: {str(e)}")

    async def send_transaction(self, transaction_data: str, opts: Optional[TxOpts] = None) -> str:
        """Send a signed transaction"""
        if not self._keypair:
            raise ValueError("Wallet not initialized")
            
        try:
            signed_tx = self.sign_transaction(transaction_data)
            response = await self._client.send_raw_transaction(
                base58.b58decode(signed_tx),
                opts=opts or TxOpts(skip_preflight=True)
            )
            return response["result"]
        except Exception as e:
            raise ValueError(f"Failed to send transaction: {str(e)}")

    def is_initialized(self) -> bool:
        """Check if wallet is initialized"""
        return self._keypair is not None
