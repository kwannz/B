from typing import Dict, Optional
import aiohttp
from ..core.config import settings
from ..models.trading import OrderSide, OrderType, TradeStatus
from ..models.market import MarketData

class JupiterDEXService:
    def __init__(self):
        self.api_url = settings.dex_settings["jupiter_api_url"]
        self.wallet_key = settings.wallet_key
        self._session: Optional[aiohttp.ClientSession] = None

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=settings.api_timeout)
            )
        return self._session

    async def get_quote(self, input_mint: str, output_mint: str, amount: float) -> Dict:
        session = await self._get_session()
        params = {
            "inputMint": input_mint,
            "outputMint": output_mint,
            "amount": str(int(amount * 10**9)),  # Convert to lamports
            "slippageBps": 50,  # 0.5% slippage
        }
        async with session.get(f"{self.api_url}/quote", params=params) as response:
            return await response.json()

    async def execute_swap(self, quote_response: Dict) -> Dict:
        session = await self._get_session()
        headers = {"Authorization": f"Wallet {self.wallet_key}"}
        async with session.post(
            f"{self.api_url}/swap",
            json=quote_response,
            headers=headers
        ) as response:
            return await response.json()

    async def get_market_data(self, token_pair: str) -> MarketData:
        session = await self._get_session()
        async with session.get(f"{self.api_url}/price", params={"id": token_pair}) as response:
            data = await response.json()
            return MarketData(
                symbol=token_pair,
                price=float(data["price"]),
                volume_24h=float(data.get("volume24h", 0)),
                high_24h=float(data.get("high24h", 0)),
                low_24h=float(data.get("low24h", 0)),
                timestamp=data.get("timestamp")
            )

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()

jupiter_service = JupiterDEXService()
