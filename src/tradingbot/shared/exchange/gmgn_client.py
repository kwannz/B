"""GMGN DEX client implementation for Solana trading."""
import os
import base64
import binascii
import json
from decimal import Decimal
from typing import Any, Dict
import aiohttp
import base58
from solders.hash import Hash
from solders.keypair import Keypair
from solders.transaction import VersionedTransaction

class GMGNClient:
    """GMGN DEX client for executing Solana trades with anti-MEV protection."""
    def __init__(self, config: Dict[str, Any]):
        """Initialize GMGN client with configuration."""
        self.session = None
        self.base_url = "https://gmgn.ai/defi/router/v1/sol"
        self.api_key = os.environ.get('walletkey')
        self.wallet_pubkey = None
        self.slippage = Decimal(str(config.get("slippage", "0.5")))
        self.fee = Decimal(str(config.get("fee", "0.002")))
        self.use_anti_mev = bool(config.get("use_anti_mev", True))

    async def start(self):
        """Initialize wallet and HTTP session."""
        try:
            if self.api_key:
                key_bytes = base58.b58decode(self.api_key.encode())
                keypair = Keypair.from_bytes(key_bytes)
                self.wallet_pubkey = str(keypair.pubkey())
        except (ValueError, TypeError) as e:
            print(f"Error initializing wallet: {e}")
        # Initialize session with required headers
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Origin": "https://gmgn.ai",
            "Referer": "https://gmgn.ai/",
            "Accept-Language": "en-US,en;q=0.9",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive"
        }
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        self.session = aiohttp.ClientSession(headers=headers)

    async def stop(self):
        """Close HTTP session and cleanup resources."""
        if self.session:
            await self.session.close()
            self.session = None
            
    async def get_quote(
        self, token_in: str, token_out: str, amount: float
    ) -> Dict[str, Any]:
        """Get quote for token swap."""
        if not self.session:
            return {"error": "Session not initialized"}

        lamports_amount = int(amount * 1e9)
        query_params = {
            "token_in_address": token_in,
            "token_out_address": token_out,
            "in_amount": str(lamports_amount),
            "from_address": self.wallet_pubkey or "",
            "slippage": str(float(self.slippage)),
            "is_anti_mev": str(self.use_anti_mev).lower(),
            "fee": "0.002"
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
        except (aiohttp.ClientError, ValueError) as e:
            return {"error": f"Failed to get quote: {str(e)}"}

    async def execute_swap(
        self, quote: Dict[str, Any], _: Any
    ) -> Dict[str, Any]:
        """Execute token swap transaction."""
        if not self.session:
            return {"error": "Session not initialized"}

        try:
            if "data" not in quote or "raw_tx" not in quote["data"]:
                return {"error": "Invalid quote response"}
                
            print("\nQuote response:")
            print(json.dumps(quote, indent=2))
            
            tx_buf = base64.b64decode(quote["data"]["raw_tx"]["swapTransaction"])
            transaction = VersionedTransaction.from_bytes(tx_buf)
            message_bytes = bytes(transaction.message)
            wallet_key = os.environ.get("walletkey")
            if wallet_key:
                key_bytes = base58.b58decode(wallet_key.encode())
                keypair = Keypair.from_bytes(key_bytes)
            hash_bytes = bytes(Hash.hash(message_bytes))
            signature = keypair.sign_message(message_bytes)  # Sign the message directly
            transaction.signatures = [signature]
            signed_tx = base64.b64encode(bytes(transaction)).decode()
            
            endpoint = ("/tx/submit_signed_bundle_transaction" if self.use_anti_mev
                      else "/tx/submit_signed_transaction")
            print(f"\nTransaction details:")
            print(f"Message hash: {hash_bytes.hex()}")
            print(f"Signature: {bytes(signature).hex()}")
            print(f"\nSubmitting to endpoint: {self.base_url}{endpoint}")
            
            endpoint = ("/tx/submit_signed_bundle_transaction" if self.use_anti_mev
                      else "/tx/submit_signed_transaction")
            print(f"\nSubmitting to endpoint: {self.base_url}{endpoint}")
            print(f"Submitting transaction to endpoint: {self.base_url}{endpoint}")
            print(f"Transaction signature: {bytes(signature).hex()}")
            async with self.session.post(
                f"{self.base_url}{endpoint}",
                json={"signed_tx": signed_tx}
            ) as response:
                response_data = await response.json()
                print(f"\nTransaction submission response:")
                print(json.dumps(response_data, indent=2))
                
                if response.status == 200 and "data" in response_data and "hash" in response_data["data"]:
                    return response_data
                return {
                    "error": "Failed to submit transaction",
                    "status": response.status,
                    "response": response_data
                }
        except (aiohttp.ClientError, ValueError, binascii.Error) as e:
            return {"error": f"Failed to execute swap: {str(e)}"}

    async def get_transaction_status(
        self, tx_hash: str, last_valid_height: int
    ) -> Dict[str, Any]:
        """Get status of submitted transaction."""
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
        except (aiohttp.ClientError, ValueError) as e:
            return {"error": f"Failed to get transaction status: {str(e)}"}

    async def get_market_data(self) -> Dict[str, Any]:
        """Get market data from GMGN."""
        if not self.session:
            return {"error": "Session not initialized"}

        try:
            async with self.session.get(
                f"{self.base_url}/market"
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return {
                        "code": 0,
                        "msg": "success",
                        "data": data
                    }
                return {
                    "error": f"Failed to get market data: {await response.text()}",
                    "status": response.status
                }
        except Exception as e:
            return {"error": f"Network error: {str(e)}"}
