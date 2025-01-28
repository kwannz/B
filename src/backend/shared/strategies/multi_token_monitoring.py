"""Multi-token monitoring strategy implementation."""

from typing import Dict, Optional, Any, List
from datetime import datetime, timedelta
import numpy as np

from tradingbot.shared.config.tenant_config import StrategyConfig
from tradingbot.models.trading import TradeStatus


class MultiTokenMonitoringStrategy:
    """Strategy that monitors multiple tokens for trading opportunities."""

    def __init__(self, config: StrategyConfig):
        """Initialize strategy with configuration parameters."""
        params = config.parameters
        
        # Validate monitoring parameters
        self.max_tokens = self._validate_positive_int(
            params.get("max_tokens", 10),
            "max_tokens"
        )
        self.update_interval = self._validate_positive_int(
            params.get("update_interval", 300),  # 5 minutes
            "update_interval"
        )
        
        # Validate volume and volatility thresholds
        self.min_volume = self._validate_positive_float(
            params.get("min_volume", 1000),
            "min_volume"
        )
        self.max_volatility = self._validate_positive_float(
            params.get("max_volatility", 0.05),  # 5% maximum volatility
            "max_volatility"
        )
        
        # Validate correlation parameters
        self.correlation_window = self._validate_positive_int(
            params.get("correlation_window", 100),
            "correlation_window"
        )
        self.correlation_threshold = self._validate_positive_float(
            params.get("correlation_threshold", 0.7),  # 70% correlation
            "correlation_threshold"
        )
        
        # Validate risk parameters
        self.max_exposure = self._validate_positive_float(
            params.get("max_exposure", 0.2),  # 20% max exposure
            "max_exposure"
        )
        self.risk_per_trade = self._validate_positive_float(
            params.get("risk_per_trade", 0.01),  # 1% risk per trade
            "risk_per_trade"
        )

    def _validate_positive_int(self, value: int, param_name: str) -> int:
        """Validate that a parameter is a positive integer."""
        try:
            value = int(value)
            if value <= 0:
                raise ValueError
            return value
        except (ValueError, TypeError):
            raise ValueError(f"{param_name} must be a positive integer")

    def _validate_positive_float(self, value: float, param_name: str) -> float:
        """Validate that a parameter is a positive float."""
        try:
            value = float(value)
            if value <= 0:
                raise ValueError
            return value
        except (ValueError, TypeError):
            raise ValueError(f"{param_name} must be a positive number")

    def _calculate_volatility(self, prices: List[float]) -> Optional[float]:
        """Calculate price volatility."""
        if len(prices) < 2:
            return None
            
        returns = np.diff(np.log(prices))
        return np.std(returns)

    def _calculate_correlation(self, prices1: List[float], prices2: List[float]) -> Optional[float]:
        """Calculate price correlation between two assets."""
        if len(prices1) != len(prices2) or len(prices1) < self.correlation_window:
            return None
            
        returns1 = np.diff(np.log(prices1[-self.correlation_window:]))
        returns2 = np.diff(np.log(prices2[-self.correlation_window:]))
        
        return np.corrcoef(returns1, returns2)[0, 1]

    def _calculate_portfolio_risk(self, positions: List[Dict]) -> float:
        """Calculate total portfolio risk."""
        total_risk = 0
        for position in positions:
            risk = position.get("amount", 0) * position.get("price", 0)
            total_risk += risk
        return total_risk

    async def calculate_signals(self, market_data: List[Dict]) -> Dict[str, Any]:
        """Calculate trading signals for multiple tokens."""
        if not market_data:
            return {
                "signal": "neutral",
                "confidence": 0.0,
                "reason": "no_data"
            }

        try:
            # Group data by token
            token_data = {}
            for data in market_data:
                pair = data["pair"]
                if pair not in token_data:
                    token_data[pair] = []
                token_data[pair].append(data)

            # Analyze each token
            token_signals = []
            for pair, data in token_data.items():
                # Check volume
                if data[-1]["volume"] < self.min_volume:
                    continue

                # Calculate volatility
                prices = [d["price"] for d in data]
                volatility = self._calculate_volatility(prices)
                
                if volatility is None or volatility > self.max_volatility:
                    continue

                # Calculate correlations with other tokens
                correlations = []
                for other_pair, other_data in token_data.items():
                    if other_pair != pair:
                        other_prices = [d["price"] for d in other_data]
                        correlation = self._calculate_correlation(prices, other_prices)
                        if correlation is not None:
                            correlations.append(correlation)

                # Generate token signal
                avg_correlation = np.mean(correlations) if correlations else 0
                signal = {
                    "pair": pair,
                    "price": data[-1]["price"],
                    "volume": data[-1]["volume"],
                    "volatility": volatility,
                    "correlation": avg_correlation
                }
                token_signals.append(signal)

            if not token_signals:
                return {
                    "signal": "neutral",
                    "confidence": 0.0,
                    "reason": "no_valid_tokens"
                }

            # Sort by volatility/correlation ratio
            token_signals.sort(
                key=lambda x: x["volatility"] / (x["correlation"] + 0.1),
                reverse=True
            )

            return {
                "signal": "monitor",
                "confidence": 1.0,
                "tokens": token_signals[:self.max_tokens],
                "next_update": (datetime.utcnow() + timedelta(seconds=self.update_interval)).isoformat()
            }

        except Exception as e:
            return {
                "signal": "neutral",
                "confidence": 0.0,
                "reason": f"error: {str(e)}"
            }

    async def execute_trade(
        self,
        tenant_id: str,
        wallet: Dict,
        market_data: Dict,
        signal: Dict
    ) -> Optional[Dict]:
        """Execute trades for monitored tokens."""
        if signal["signal"] != "monitor":
            return None

        # Calculate position sizes based on risk
        total_portfolio = float(wallet.get("balance", 0))
        max_risk = total_portfolio * self.max_exposure
        risk_per_token = max_risk / len(signal["tokens"])

        trades = []
        for token in signal["tokens"]:
            position_size = risk_per_token / token["price"]
            trade = {
                "tenant_id": tenant_id,
                "wallet_address": wallet["address"],
                "pair": token["pair"],
                "side": "buy",  # Initial position
                "amount": position_size,
                "price": token["price"],
                "status": TradeStatus.PENDING,
                "trade_metadata": {
                    "volatility": token["volatility"],
                    "correlation": token["correlation"],
                    "risk_amount": risk_per_token,
                    "next_update": signal["next_update"]
                }
            }
            trades.append(trade)

        return {
            "tenant_id": tenant_id,
            "wallet_address": wallet["address"],
            "trades": trades,
            "trade_metadata": {
                "total_risk": max_risk,
                "risk_per_trade": risk_per_token,
                "next_update": signal["next_update"]
            }
        }

    async def update_positions(
        self,
        tenant_id: str,
        market_data: Optional[Dict]
    ) -> Optional[Dict]:
        """Update existing positions based on new market data."""
        if market_data is None:
            raise ValueError("Market data cannot be None")

        current_time = datetime.utcnow()
        
        result = {
            "status": TradeStatus.OPEN,
            "trade_metadata": {
                "current_time": current_time.isoformat()
            }
        }

        # Check if update is needed
        next_update = datetime.fromisoformat(result["trade_metadata"].get("next_update", ""))
        if current_time >= next_update:
            result["status"] = TradeStatus.CLOSED
            result["trade_metadata"]["exit_reason"] = "rebalance"

        return result
