from typing import Dict, Optional
import asyncio
import aiohttp
from decimal import Decimal
import json
import logging
import time

from ..core.config import settings
from ..models.trading import OrderSide, OrderType, TradeStatus
from ..monitoring.metrics import record_swap

logger = logging.getLogger(__name__)

class SolanaSwapService:
    def __init__(self):
        self.quote_url = "https://quote-api.jup.ag/v6"
        self.swap_url = "https://api.jup.ag/v6"
        self.wallet_key = settings.SOLANA_WALLET_KEY
        self._session: Optional[aiohttp.ClientSession] = None
        logger.info(f"Initialized SolanaSwapService with wallet key: {self.wallet_key}")
        
    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=settings.api_timeout)
            )
        return self._session

    async def get_swap_quote(
        self,
        input_mint: str,
        output_mint: str,
        amount: Decimal,
        slippage_bps: int = 50
    ) -> Dict:
        try:
            session = await self._get_session()
            # Convert amount based on USDC decimals (6)
            amount_base = str(int(amount))
            logger.info(f"Using amount in base units: {amount_base}")
            
            # Format request according to Jupiter API v6
            params = {
                "inputMint": input_mint,
                "outputMint": output_mint,
                "amount": amount_base,
                "slippageBps": str(slippage_bps),
                "platformFeeBps": "0",
                "onlyDirectRoutes": "false",
                "asLegacyTransaction": "false",
                "wrapUnwrapSOL": "true",
                "computeUnitPriceMicroLamports": "1"
            }
            logger.info(f"Quote params: {params}")
            async with session.get(f"{self.quote_url}/quote", params=params) as response:
                if response.status != 200:
                    error_text = await response.text()
                    logger.error(f"Quote error: {error_text}")
                    return {"success": False, "error": f"Quote failed: {error_text}"}
                
                quote_data = await response.json()
                logger.info(f"Raw quote response: {quote_data}")
                
                if "error" in quote_data:
                    return {"success": False, "error": quote_data["error"]}
                
                # Jupiter API returns the route data directly
                if not quote_data:
                    return {"success": False, "error": "No route data in response"}
                    
                return {"success": True, "data": quote_data}
        except Exception as e:
            logger.error(f"Error getting swap quote: {e}")
            return {"success": False, "error": str(e)}

    async def execute_swap(self, quote_response: Dict) -> Dict:
        start_time = time.time()
        market = quote_response.get("data", {}).get("inputMint", "unknown")
        try:
            if not quote_response.get("data"):
                return {"success": False, "error": "Invalid quote data"}
                
            session = await self._get_session()
            headers = {"Authorization": f"Wallet {self.wallet_key}"}
            
            if not quote_response.get("data"):
                return {"success": False, "error": "No quote data received"}
                
            # Log quote response for debugging
            logger.info(f"Quote response data: {quote_response['data']}")
            
            # Extract required fields from quote response
            route = quote_response["data"]
            
            # Extract route data from quote response
            if not isinstance(route, dict):
                logger.error(f"Invalid route data type: {type(route)}")
                return {
                    "success": False,
                    "error": "Invalid route data format",
                    "status": TradeStatus.FAILED
                }
            
            # Use swap-instructions endpoint for better transaction control
            swap_url = "https://quote-api.jup.ag/v6/swap-instructions"
            
            # Save raw quote response for debugging
            with open('/home/ubuntu/repos/B/quote_response.json', 'w') as f:
                json.dump(quote_response["data"], f, indent=2)
            
            # Format request according to Jupiter API v6 requirements
            swap_request = {
                "route": quote_response["data"],
                "userPublicKey": self.wallet_key.strip(),
                "wrapUnwrapSOL": True,
                "computeUnitPriceMicroLamports": None
            }
            
            logger.info(f"Swap request: {json.dumps(swap_request, indent=2)}")
            logger.info(f"Making request to: {swap_url}")
            logger.info(f"Request headers: {{'Content-Type': 'application/json'}}")
            
            async with session.post(
                swap_url,
                json=swap_request,
                headers={
                    "Content-Type": "application/json"
                }
            ) as response:
                response_text = await response.text()
                logger.info(f"Response status: {response.status}")
                logger.info(f"Response headers: {dict(response.headers)}")
                logger.info(f"Raw response text: {response_text}")
                
                if response.status != 200:
                    logger.error(f"Swap error: {response_text}")
                    raise ValueError(f"Failed to execute swap: {response_text}")
                
                try:
                    response_data = json.loads(response_text)
                    logger.info(f"Parsed response: {json.dumps(response_data, indent=2)}")
                    
                    if "error" in response_data:
                        raise ValueError(f"API error: {response_data['error']}")
                    
                    quote_data = quote_response["data"]
                    volume = Decimal(str(quote_data.get("inAmount", 0)))
                    slippage = Decimal("50") / Decimal("10000")
                    risk_level = Decimal("0.5")
                    liquidity = {"jupiter": Decimal(str(quote_data.get("outAmount", 0)))}
                    
                    record_swap(
                        market=market,
                        status=TradeStatus.PREPARED.value,
                        volume=volume,
                        latency=time.time() - start_time,
                        slippage=slippage,
                        risk_level=risk_level,
                        liquidity=liquidity
                    )
                    
                    # Extract instruction components
                    token_ledger = response_data.get("tokenLedgerInstruction")
                    compute_budget = response_data.get("computeBudgetInstructions", [])
                    setup = response_data.get("setupInstructions", [])
                    swap = response_data.get("swapInstruction")
                    cleanup = response_data.get("cleanupInstruction")
                    lookup_tables = response_data.get("addressLookupTableAddresses", [])
                    
                    if not swap:
                        raise ValueError("No swap instruction received in response")
                        
                    return {
                        "success": True,
                        "status": TradeStatus.PREPARED,
                        "instructions": {
                            "tokenLedger": token_ledger,
                            "computeBudget": compute_budget,
                            "setup": setup,
                            "swap": swap,
                            "cleanup": cleanup,
                            "lookupTables": lookup_tables
                        },
                        "quote": {
                            "inAmount": quote_data.get("inAmount"),
                            "outAmount": quote_data.get("outAmount"),
                            "inputMint": quote_data.get("inputMint"),
                            "outputMint": quote_data.get("outputMint")
                        }
                    }
                except json.JSONDecodeError as e:
                    logger.error(f"JSON decode error: {str(e)}")
                    logger.error(f"Failed to parse response: {response_text}")
                    raise ValueError(f"Failed to parse swap response: {str(e)}")
                
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"Error executing swap: {e}")
            record_swap(
                market=market,
                status=TradeStatus.FAILED.value,
                volume=Decimal("0"),
                latency=float(duration),
                slippage=Decimal("0"),
                risk_level=Decimal("0"),
                liquidity={}
            )
            return {
                "success": False,
                "error": str(e),
                "status": TradeStatus.FAILED
            }

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()

solana_swap_service = SolanaSwapService()
