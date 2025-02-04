import asyncio
import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from src.shared.db.mongodb import MongoDBManager
from src.shared.metrics.metrics_manager import MetricsManager
from src.shared.sentiment.sentiment_analyzer import analyze_text

from .base_agent import BaseAgent


class MemeCoinAgent(BaseAgent):
    def __init__(
        self,
        name: str,
        config: Dict[str, Any],
        db_manager: MongoDBManager,
        metrics_manager: MetricsManager,
    ):
        super().__init__(name)
        self.config = config
        self.db_manager = db_manager
        self.metrics_manager = metrics_manager
        self.sentiment_threshold = config.get("sentiment_threshold", 0.5)
        self.momentum_window = config.get("momentum_window", 24)
        self.min_volume = config.get("min_volume", 1000)
        self.max_slippage = config.get("max_slippage", 0.05)
        self.max_position_size = config.get("max_position_size", 0.1)  # Max 10% of portfolio
        self.max_concentration = config.get("max_concentration", 0.2)  # Max 20% in meme tokens
        self.volatility_threshold = config.get("volatility_threshold", 1.5)
        self.min_liquidity_ratio = config.get("min_liquidity_ratio", 5.0)  # 5x position size

    async def analyze_market_sentiment(self, symbol: str) -> Dict[str, float]:
        social_data = await self.db_manager.mongodb.social_metrics.find_one(
            {"symbol": symbol}, sort=[("timestamp", -1)]
        )

        if not social_data:
            return {"score": 0.5, "momentum": 0}

        sentiment_score = social_data.get("sentiment_score", 0.5)
        momentum = social_data.get("price_momentum", 0)

        return {"score": sentiment_score, "momentum": momentum}

    async def check_risk_requirements(self, symbol: str, amount: float) -> Dict[str, Any]:
        market_data = await self.db_manager.mongodb.market_data.find_one(
            {"symbol": symbol}, sort=[("timestamp", -1)]
        )

        if not market_data:
            return {"passed": False, "reason": "no_market_data"}

        volume_24h = market_data.get("volume_24h", 0)
        volatility = market_data.get("volatility", float("inf"))
        liquidity = market_data.get("liquidity", 0)
        
        # Volume check
        if volume_24h < self.min_volume:
            return {"passed": False, "reason": "insufficient_volume"}
            
        # Volatility check
        if volatility > self.volatility_threshold:
            return {"passed": False, "reason": "high_volatility"}
            
        # Liquidity check
        if liquidity < amount * self.min_liquidity_ratio:
            return {"passed": False, "reason": "insufficient_liquidity"}
            
        # Position concentration check
        portfolio_value = await self.get_portfolio_value()
        if amount > portfolio_value * self.max_position_size:
            return {"passed": False, "reason": "position_too_large"}
            
        # Total meme exposure check
        meme_exposure = await self.get_meme_exposure()
        if (meme_exposure + amount) > portfolio_value * self.max_concentration:
            return {"passed": False, "reason": "high_meme_exposure"}
            
        return {
            "passed": True,
            "metrics": {
                "volume_ratio": amount / volume_24h,
                "volatility": volatility,
                "liquidity_ratio": liquidity / amount,
                "position_ratio": amount / portfolio_value,
                "meme_exposure": (meme_exposure + amount) / portfolio_value
            }
        }

    async def get_trading_signal(self, symbol: str) -> Dict[str, Any]:
        sentiment = await self.analyze_market_sentiment(symbol)
        position_size = await self.calculate_position_size(symbol)
        risk_check = await self.check_risk_requirements(symbol, position_size)

        if not risk_check["passed"]:
            return {
                "action": "hold",
                "reason": risk_check["reason"],
                "metrics": {
                    "sentiment": sentiment["score"],
                    "momentum": sentiment["momentum"],
                    "risk_metrics": risk_check.get("metrics", {})
                },
            }

        if sentiment["score"] >= self.sentiment_threshold and sentiment["momentum"] > 0:
            return {
                "action": "buy",
                "reason": "positive_sentiment_momentum",
                "metrics": {
                    "sentiment": sentiment["score"],
                    "momentum": sentiment["momentum"],
                },
            }
        elif sentiment["score"] < self.sentiment_threshold or sentiment["momentum"] < 0:
            return {
                "action": "sell",
                "reason": "negative_sentiment_momentum",
                "metrics": {
                    "sentiment": sentiment["score"],
                    "momentum": sentiment["momentum"],
                },
            }

        return {
            "action": "hold",
            "reason": "neutral_conditions",
            "metrics": {
                "sentiment": sentiment["score"],
                "momentum": sentiment["momentum"],
            },
        }

    async def get_portfolio_value(self) -> float:
        portfolio = await self.db_manager.mongodb.portfolio.find_one(
            {"user_id": self.config.get("user_id")}
        )
        return float(portfolio.get("total_value", 0)) if portfolio else 0.0

    async def get_meme_exposure(self) -> float:
        positions = await self.db_manager.mongodb.positions.find(
            {"user_id": self.config.get("user_id"), "is_meme": True}
        ).to_list(length=None)
        return sum(float(p.get("value", 0)) for p in positions)

    async def calculate_position_size(self, symbol: str) -> float:
        portfolio_value = await self.get_portfolio_value()
        risk_per_trade = self.config.get("risk_per_trade", 0.02)  # 2% per trade
        return portfolio_value * risk_per_trade

    async def place_buy_order(self, symbol: str, amount: float) -> Dict[str, Any]:
        # Implement order placement logic
        return {"status": "success", "amount": amount, "symbol": symbol}

    async def place_sell_order(self, symbol: str, amount: float) -> Dict[str, Any]:
        # Implement order placement logic
        return {"status": "success", "amount": amount, "symbol": symbol}

    async def execute_trade(
        self, symbol: str, action: str, amount: float
    ) -> Dict[str, Any]:
        try:
            if action == "buy":
                order = await self.place_buy_order(symbol, amount)
            elif action == "sell":
                order = await self.place_sell_order(symbol, amount)
            else:
                return {"success": False, "error": "Invalid action"}

            await self.metrics_manager.update_metrics(
                "trading",
                {
                    "memeCoin": {
                        "volume": amount,
                        "sentiment": order.get("metrics", {}).get("sentiment", 0),
                        "momentum": order.get("metrics", {}).get("momentum", 0),
                        "totalTrades": 1,
                    }
                },
            )

            return {
                "success": True,
                "order": order,
                "metrics": {
                    "sentiment": order.get("metrics", {}).get("sentiment", 0),
                    "momentum": order.get("metrics", {}).get("momentum", 0),
                },
            }

        except Exception as e:
            return {"success": False, "error": str(e)}

    async def run_trading_cycle(self, symbol: str) -> Dict[str, Any]:
        signal = await self.get_trading_signal(symbol)

        if signal["action"] == "hold":
            return {
                "action": "hold",
                "reason": signal["reason"],
                "metrics": signal["metrics"],
            }

        position_size = await self.calculate_position_size(symbol)
        if position_size <= 0:
            return {
                "action": "hold",
                "reason": "insufficient_funds",
                "metrics": signal["metrics"],
            }

        trade_result = await self.execute_trade(symbol, signal["action"], position_size)

        return {
            "action": signal["action"],
            "success": trade_result["success"],
            "reason": signal["reason"],
            "metrics": signal["metrics"],
            "trade_details": trade_result.get("order", {}),
        }
