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
            
            # Sign the message and create signature
            signature = wallet.sign_message(message_bytes)
            sig_bytes = bytes(signature)
            
            # Create signature array with proper format
            sig_array = [x for x in sig_bytes]  # Convert signature to list of integers
            
            # Parse and sign transaction preserving original format
            tx = VersionedTransaction.from_bytes(tx_buf)
            message = tx.message
            
            # Sign the message
            signature = wallet.sign_message(bytes(message))
            sig_bytes = bytes(signature)
            sig_array = [x for x in sig_bytes]
            
            # Create transaction buffer with exact original format
            # Create transaction buffer with exact original format
            # Parse transaction and examine format
            tx = VersionedTransaction.from_bytes(tx_buf)
            message = tx.message
            
            # Print original transaction format
            print(f"\nOriginal transaction format:")
            print(f"- First 32 bytes: {tx_buf[:32].hex()}")
            print(f"- Version byte: {tx_buf[0]:02x}")
            print(f"- Header bytes: {tx_buf[1:4].hex()}")
            print(f"- Total length: {len(tx_buf)}")
            print(f"- Message length: {len(bytes(message))}")
            
            # Sign the message
            signature = wallet.sign_message(bytes(message))
            sig_bytes = bytes(signature)
            sig_array = [x for x in sig_bytes]
            
            # Create transaction buffer preserving exact format
            tx_bytes = bytearray(tx_buf)  # Start with original buffer
            sig_start = 1  # After version byte
            tx_bytes[sig_start:sig_start + len(sig_array)] = sig_array  # Replace signature
            
            # Print final transaction format
            print(f"\nFinal transaction format:")
            print(f"- First 32 bytes: {tx_bytes[:32].hex()}")
            print(f"- Version byte: {tx_bytes[0]:02x}")
            print(f"- Header bytes: {tx_bytes[1:4].hex()}")
            print(f"- Total length: {len(tx_bytes)}")
            print(f"- Signature: {bytes(sig_array).hex()[:32]}...")
            
            # Print debug info
            print(f"\nTransaction details:")
            print(f"- Original tx length: {len(tx_buf)}")
            print(f"- Signature length: {len(sig_array)}")
            print(f"- Message length: {len(bytes(message))}")
            print(f"- Signature: {bytes(sig_array).hex()[:32]}...")
            
            signed_tx = base64.b64encode(bytes(tx_bytes)).decode()
            
            # Submit transaction with anti-MEV protection if enabled
            endpoint = "/tx/submit_signed_bundle_transaction" if self.use_anti_mev else "/tx/submit_signed_transaction"
            print(f"\nSubmitting transaction to {self.base_url}{endpoint}")
            
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
