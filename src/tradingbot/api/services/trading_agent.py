from typing import Dict, Optional
import asyncio
from datetime import datetime

from ..models.trading import OrderSide, OrderType, TradeStatus
from ..models.risk import RiskAssessment, RiskProfile
from ..core.config import settings
from .jupiter import jupiter_service

class TradingAgent:
    def __init__(self):
        self.risk_profile = RiskProfile(
            max_position_size=settings.max_trade_size_sol,
            risk_level=settings.risk_level,
            risk_management_enabled=settings.risk_management_enabled
        )
        self.active_trades: Dict[str, Dict] = {}

    async def assess_trade_risk(self, symbol: str, amount: float, side: OrderSide) -> RiskAssessment:
        market_data = await jupiter_service.get_market_data(symbol)
        
        assessment = RiskAssessment(
            symbol=symbol,
            risk_level="high" if amount > self.risk_profile.max_position_size * 0.5 else "medium",
            timestamp=datetime.utcnow(),
            metrics={
                "position_size": amount,
                "market_volatility": market_data.volatility if hasattr(market_data, 'volatility') else None,
                "liquidity": market_data.volume_24h
            }
        )
        return assessment

    async def execute_trade(self, input_mint: str, output_mint: str, amount: float, side: OrderSide) -> Dict:
        try:
            # Get quote from Jupiter
            quote = await jupiter_service.get_quote(input_mint, output_mint, amount)
            
            # Execute swap
            if quote.get("data"):
                swap_result = await jupiter_service.execute_swap(quote["data"])
                return {
                    "status": TradeStatus.EXECUTED,
                    "transaction_id": swap_result.get("txid"),
                    "price": quote["data"].get("price"),
                    "amount": amount,
                    "timestamp": datetime.utcnow().isoformat()
                }
            else:
                return {
                    "status": TradeStatus.FAILED,
                    "error": "Failed to get quote",
                    "timestamp": datetime.utcnow().isoformat()
                }
        except Exception as e:
            return {
                "status": TradeStatus.FAILED,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }

    async def close(self):
        await jupiter_service.close()

trading_agent = TradingAgent()
