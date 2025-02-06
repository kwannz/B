from typing import Any, Dict, Optional
import base64
from decimal import Decimal
import aiohttp
import os
from solders.transaction import Transaction, VersionedTransaction
from solders.message import MessageV0
from solders.keypair import Keypair
from solders.signature import Signature
from solders.presigner import Presigner
from solders.hash import Hash

class GMGNClient:
    def __init__(self, config: Dict[str, Any]):
        self.session = None
        self.base_url = "https://gmgn.ai/defi/router/v1/sol"
        self.api_key = os.environ.get('walletkey')
        self.wallet_pubkey = None  # Will be set during initialization
        self.slippage = Decimal(str(config.get("slippage", "0.5")))
        self.fee = Decimal(str(config.get("fee", "0.002")))
        self.use_anti_mev = bool(config.get("use_anti_mev", True))
        self.wallet_address = config.get("wallet_address")
        
    async def start(self):
        # Initialize wallet from API key
        from solders.keypair import Keypair
        import base58
        try:
            key_bytes = base58.b58decode(self.api_key)
            keypair = Keypair.from_bytes(key_bytes)
            self.wallet_pubkey = str(keypair.pubkey())
        except Exception as e:
            print(f"Error initializing wallet: {e}")
            
        # Initialize session with required headers
        self.session = aiohttp.ClientSession(
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
                "X-API-Key": self.api_key,
                "Origin": "https://gmgn.ai",
                "Referer": "https://gmgn.ai/",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept-Language": "en-US,en;q=0.9",
                "Accept-Encoding": "gzip, deflate, br",
                "Connection": "keep-alive"
            }
        )
        
    async def stop(self):
        if self.session:
            await self.session.close()
            self.session = None
            
    async def get_quote(
        self, token_in: str, token_out: str, amount: float
    ) -> Dict[str, Any]:
        if not self.session:
            return {"error": "Session not initialized"}
            
        lamports_amount = int(amount * 1e9)  # Convert SOL to lamports
        params = {
            "token_in_address": token_in,
            "token_out_address": token_out,
            "in_amount": str(lamports_amount),
            "from_address": self.wallet_pubkey or "",
            "slippage": str(float(self.slippage)),
            "is_anti_mev": str(self.use_anti_mev).lower(),
            "fee": "0.002"  # Required minimum fee for anti-MEV protection
        }
        
        try:
            print(f"\nAttempting to get quote from {self.base_url}/tx/get_swap_route")
            
            # Build URL with query parameters
            query_params = {
                "token_in_address": token_in,
                "token_out_address": token_out,
                "in_amount": str(lamports_amount),
                "from_address": self.wallet_pubkey or "",
                "slippage": str(float(self.slippage)),
                "fee": "0.002",  # Required minimum fee for anti-MEV protection
                "is_anti_mev": str(self.use_anti_mev).lower()
            }
            url = f"{self.base_url}/tx/get_swap_route"
            print(f"\nFull URL: {url}")
            print(f"Query parameters: {query_params}")
            
            async with self.session.get(
                url,
                params=query_params,
                verify_ssl=False
            ) as response:
                response_text = await response.text()
                print(f"\nResponse status: {response.status}")
                print(f"Response headers: {response.headers}")
                print(f"Response text: {response_text}")
                if response.status == 200:
                    return await response.json()
                return {
                    "error": "Failed to get quote",
                    "status": response.status,
                    "message": await response.text()
                }
        except Exception as e:
            return {"error": str(e)}
            
    async def execute_swap(
        self, quote: Dict[str, Any], wallet: Any
    ) -> Dict[str, Any]:
        if not self.session:
            return {"error": "Session not initialized"}
            
        try:
            if "data" not in quote or "raw_tx" not in quote["data"]:
                return {"error": "Invalid quote response"}
                
            tx_buf = base64.b64decode(quote["data"]["raw_tx"]["swapTransaction"])
            # Parse transaction and prepare for signing
            tx = VersionedTransaction.from_bytes(tx_buf)
            message_bytes = bytes(tx.message)
            
            # Sign the message and prepare signature
            signature = wallet.sign_message(message_bytes)
            sig_bytes = bytes(signature)[:64]
            
            # Create a new transaction with our signature
            tx = VersionedTransaction.from_bytes(tx_buf)  # Create fresh transaction
            tx.signatures = []  # Clear any existing signatures
            tx.signatures.append(list(sig_bytes))  # Add our signature as list of bytes
            
            # Sign the transaction
            tx = VersionedTransaction.from_bytes(tx_buf)  # Create fresh transaction
            tx.signatures = []  # Clear any existing signatures
            
            # Sign the transaction
            tx = VersionedTransaction.from_bytes(tx_buf)  # Create fresh transaction
            message_bytes = bytes(tx.message)
            
            # Sign the message and create signature
            signature = wallet.sign_message(message_bytes)
            sig_bytes = bytes(signature)
            
            # Create a new transaction with proper signature format
            tx = VersionedTransaction.from_bytes(tx_buf)  # Create fresh transaction
            tx.signatures = []  # Clear any existing signatures
            tx.signatures.append([x for x in sig_bytes])  # Add signature as list of integers
            
            # Serialize and encode transaction
            tx_serialized = bytes(tx)
            signed_tx = base64.b64encode(tx_serialized).decode()
            
            # Submit transaction with anti-MEV protection if enabled
            endpoint = "/tx/submit_signed_bundle_transaction" if self.use_anti_mev else "/tx/submit_signed_transaction"
            print(f"\nSubmitting transaction to {self.base_url}{endpoint}")
            print(f"Transaction signature length: {len(sig_bytes)}")
            print(f"Transaction buffer length: {len(tx_serialized)}")
            
            async with self.session.post(
                f"{self.base_url}{endpoint}",
                json={"signed_tx": signed_tx}
            ) as response:
                response_text = await response.text()
                print(f"Response status: {response.status}")
                print(f"Response text: {response_text}")
                
                if response.status == 200:
                    result = await response.json()
                    print(f"Transaction submitted successfully: {result}")
                    return result
                print(f"Transaction submission failed: {response_text}")
                return {
                    "error": "Failed to submit transaction",
                    "status": response.status,
                    "message": response_text
                }
            
            # Encode and submit transaction
            signed_tx = base64.b64encode(bytes(tx)).decode()
            print(f"\nTransaction details:")
            print(f"- Transaction length: {len(signed_tx)}")
            print(f"- Message length: {len(message_bytes)}")
            print(f"- Transaction signatures: {[bytes(bytearray(s)).hex() for s in tx.signatures]}")
            
            # Submit transaction with anti-MEV protection if enabled
            endpoint = "/tx/submit_signed_bundle_transaction" if self.use_anti_mev else "/tx/submit_signed_transaction"
            print(f"\nSubmitting transaction to {self.base_url}{endpoint}")
            
            async with self.session.post(
                f"{self.base_url}{endpoint}",
                json={"signed_tx": signed_tx}
            ) as response:
                if response.status == 200:
                    return await response.json()
                return {
                    "error": "Failed to submit transaction",
                    "status": response.status,
                    "message": await response.text()
                }
        except Exception as e:
            return {"error": str(e)}
            
    async def get_transaction_status(
        self, tx_hash: str, last_valid_height: int
    ) -> Dict[str, Any]:
        if not self.session:
            return {"error": "Session not initialized"}
            
        params = {
            "hash": tx_hash,
            "last_valid_height": last_valid_height
        }
        
        try:
            async with self.session.get(
                f"{self.base_url}/tx/get_transaction_status",
                params=params
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    if data["data"].get("expired", False):
                        return {"error": "Transaction expired", "expired": True}
                    return data
                return {
                    "error": "Failed to get status",
                    "status": response.status,
                    "message": await response.text()
                }
        except Exception as e:
            return {"error": str(e)}
