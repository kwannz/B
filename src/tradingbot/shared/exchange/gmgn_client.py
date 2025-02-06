"""GMGN DEX client implementation for Solana trading."""
import os
import base64
import binascii
import json
import asyncio
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
        # CloudFlare configuration
        self.cf_clearance = None
        self.cf_retry_count = config.get("cf_retry_count", 3)
        self.cf_retry_delay = config.get("cf_retry_delay", 5)
        self.user_agent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
        self.cookies = {}

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
            "Accept": "*/*",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "application/json",
            "Origin": "https://gmgn.ai",
            "Pragma": "no-cache",
            "Referer": "https://gmgn.ai/",
            "Sec-Ch-Ua": '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Linux"',
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
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
            "fee": "0.002",
            "is_anti_mev": str(self.use_anti_mev).lower()
        }
        url = f"{self.base_url}/tx/get_swap_route"

        retry_count = self.cf_retry_count
        while retry_count > 0:
            try:
                async with self.session.get(
                    url,
                    params=query_params,
                    verify_ssl=False,
                    allow_redirects=True,
                    timeout=30
                ) as response:
                    if response.status == 403 and "cf-" in str(response.headers).lower():
                        retry_count -= 1
                        if retry_count > 0:
                            await asyncio.sleep(self.cf_retry_delay)
                            continue
                        return {"error": "CloudFlare protection active"}
                    
                    if response.status == 200:
                        return await response.json()
                    return {
                        "error": "Failed to get quote",
                        "status": response.status,
                        "message": await response.text()
                    }
            except Exception as e:
                retry_count -= 1
                if retry_count > 0:
                    await asyncio.sleep(self.cf_retry_delay)
                    continue
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
            
            tx_buf = base64.b64decode(quote["data"]["raw_tx"]["swapTransaction"])
            transaction = VersionedTransaction.from_bytes(tx_buf)
            message_bytes = bytes(transaction.message)
            wallet_key = os.environ.get("walletkey")
            if wallet_key:
                key_bytes = base58.b58decode(wallet_key.encode())
                keypair = Keypair.from_bytes(key_bytes)
            hash_bytes = bytes(Hash.hash(message_bytes))
            signature = keypair.sign_message(message_bytes)
            transaction.signatures = [signature]
            signed_tx = base64.b64encode(bytes(transaction)).decode()
            
            endpoint = ("/tx/submit_signed_bundle_transaction" if self.use_anti_mev
                      else "/tx/submit_signed_transaction")
            url = f"{self.base_url}{endpoint}"
            
            retry_count = self.cf_retry_count
            while retry_count > 0:
                try:
                    async with self.session.post(
                        url,
                        json={"signed_tx": signed_tx},
                        verify_ssl=False,
                        allow_redirects=True,
                        timeout=30
                    ) as response:
                        if response.status == 403 and "cf-" in str(response.headers).lower():
                            retry_count -= 1
                            if retry_count > 0:
                                await asyncio.sleep(self.cf_retry_delay)
                                continue
                            return {"error": "CloudFlare protection active"}
                        
                        response_data = await response.json()
                        if response.status == 200 and "data" in response_data and "hash" in response_data["data"]:
                            return response_data
                        return {
                            "error": "Failed to submit transaction",
                            "status": response.status,
                            "response": response_data
                        }
                except Exception as e:
                    retry_count -= 1
                    if retry_count > 0:
                        await asyncio.sleep(self.cf_retry_delay)
                        continue
                    return {"error": f"Failed to execute swap: {str(e)}"}
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
            retry_count = self.cf_retry_count
            while retry_count > 0:
                try:
                    async with self.session.get(
                        f"{self.base_url}/market",
                        verify_ssl=False,
                        allow_redirects=True,
                        timeout=30
                    ) as response:
                        if response.status == 403 and "cf-" in str(response.headers).lower():
                            retry_count -= 1
                            if retry_count > 0:
                                await asyncio.sleep(self.cf_retry_delay)
                                continue
                            return {"error": "CloudFlare protection active"}
                        
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
                    retry_count -= 1
                    if retry_count > 0:
                        await asyncio.sleep(self.cf_retry_delay)
                        continue
                    return {"error": f"Network error: {str(e)}"}
        except Exception as e:
            return {"error": f"Network error: {str(e)}"}
