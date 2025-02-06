from typing import Any, Dict, Optional
import base64
from decimal import Decimal
import aiohttp
from solana.transaction import VersionedTransaction

class GMGNClient:
    def __init__(self, config: Dict[str, Any]):
        self.session = None
        self.base_url = "https://gmgn.ai/defi/router/v1/sol"
        self.slippage = Decimal(str(config.get("slippage", "0.5")))
        self.fee = Decimal(str(config.get("fee", "0.002")))
        self.use_anti_mev = bool(config.get("use_anti_mev", True))
        self.wallet_address = config.get("wallet_address")
        
    async def start(self):
        self.session = aiohttp.ClientSession()
        
    async def stop(self):
        if self.session:
            await self.session.close()
            self.session = None
            
    async def get_quote(
        self, token_in: str, token_out: str, amount: float
    ) -> Dict[str, Any]:
        if not self.session:
            return {"error": "Session not initialized"}
            
        params = {
            "token_in_address": token_in,
            "token_out_address": token_out,
            "in_amount": str(int(amount * 1e9)),  # Convert to lamports
            "from_address": self.wallet_address,
            "slippage": float(self.slippage),
            "is_anti_mev": self.use_anti_mev,
            "fee": float(self.fee)
        }
        
        try:
            async with self.session.get(
                f"{self.base_url}/tx/get_swap_route", params=params
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
            tx_buf = base64.b64decode(quote["data"]["raw_tx"]["swapTransaction"])
            tx = VersionedTransaction.deserialize(tx_buf)
            tx.sign([wallet.payer])
            signed_tx = base64.b64encode(tx.serialize()).decode()
            
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
