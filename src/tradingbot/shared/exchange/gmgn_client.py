from typing import Any, Dict, Optional
import base64
from decimal import Decimal
import aiohttp
import os
from solders.transaction import Transaction

class GMGNClient:
    def __init__(self, config: Dict[str, Any]):
        self.session = None
        self.base_url = "https://api.gmgn.io/v1/solana"
        self.slippage = Decimal(str(config.get("slippage", "0.5")))
        self.fee = Decimal(str(config.get("fee", "0.002")))
        self.use_anti_mev = bool(config.get("use_anti_mev", True))
        self.wallet_address = config.get("wallet_address")
        
    async def start(self):
        headers = {
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Origin": "https://gmgn.io",
            "Referer": "https://gmgn.io/"
        }
        self.session = aiohttp.ClientSession(headers=headers)
        
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
            "inToken": token_in,
            "outToken": token_out,
            "inAmount": str(lamports_amount),
            "slippage": str(float(self.slippage)),
            "antiMev": str(self.use_anti_mev).lower(),
            "fee": str(float(self.fee)),
            "version": "2"
        }
        
        try:
            async with self.session.post(
                f"{self.base_url}/swap/create",
                json=params,
                headers={
                    "Authorization": f"Bearer {os.environ.get('walletkey')}",
                    "Accept": "application/json"
                }
            ) as response:
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
                
            tx_buf = base64.b64decode(quote["data"]["raw_tx"]["swap_tx"])
            # Parse and sign transaction with wallet
            tx = Transaction.from_bytes(tx_buf)
            tx.sign([wallet])  # Sign with provided wallet
            signed_tx = base64.b64encode(bytes(tx)).decode()
            
            # Submit transaction with anti-MEV protection if enabled
            endpoint = (
                "/tx/submit_signed_bundle_transaction" 
                if self.use_anti_mev else 
                "/tx/submit_signed_transaction"
            )
            
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
