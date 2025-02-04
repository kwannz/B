"""
Risk management service for monitoring and controlling trading risks
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..core.exceptions import NotFoundError, RiskLimitError, ValidationError
from ..models.risk import (
    RiskAssessment,
    RiskLevel,
    RiskLimit,
    RiskMetrics,
    RiskProfile,
    RiskType,
)
from ..models.trading import MarketType, Order, Position


class RiskManagementService:
    """Risk management service for monitoring and controlling trading risks."""

    def __init__(self, db: AsyncIOMotorDatabase):
        """Initialize risk management service."""
        self.db = db
        self.risk_metrics = db.risk_metrics
        self.risk_limits = db.risk_limits
        self.risk_profiles = db.risk_profiles
        self.risk_assessments = db.risk_assessments

    async def _validate_risk_limits(self, limits: RiskLimit) -> None:
        """Validate risk limits."""
        if limits.max_position_size <= Decimal("0"):
            raise ValidationError("Maximum position size must be positive")
        if limits.max_leverage <= 0:
            raise ValidationError("Maximum leverage must be positive")
        if limits.max_drawdown <= 0:
            raise ValidationError("Maximum drawdown must be positive")
        if limits.max_daily_loss <= Decimal("0"):
            raise ValidationError("Maximum daily loss must be positive")
        if limits.trading_hours_start >= limits.trading_hours_end:
            raise ValidationError("Trading hours start must be before end")

    async def _validate_risk_profile(self, profile: RiskProfile) -> None:
        """Validate risk profile."""
        if profile.max_drawdown_tolerance <= 0:
            raise ValidationError("Maximum drawdown tolerance must be positive")
        if profile.target_annual_return <= 0:
            raise ValidationError("Target annual return must be positive")
        if profile.max_positions <= 0:
            raise ValidationError("Maximum positions must be positive")

    async def get_risk_metrics(self, user_id: ObjectId) -> RiskMetrics:
        """Get current risk metrics for user."""
        metrics_data = await self.risk_metrics.find_one({"user_id": user_id})
        if not metrics_data:
            # Initialize default metrics
            metrics = RiskMetrics(
                user_id=user_id,
                var_95=Decimal("0"),
                var_99=Decimal("0"),
                cvar_95=Decimal("0"),
                expected_shortfall=Decimal("0"),
                volatility=0,
                beta=0,
                correlation=0,
                position_concentration=0,
                leverage_ratio=0,
                margin_usage=0,
                liquidity_score=100,
                avg_spread=0,
                slippage_impact=0,
                delta=0,
                gamma=0,
                vega=0,
                theta=0,
                stress_test_loss=Decimal("0"),
                risk_adjusted_return=0,
                diversification_score=100,
            )
            await self.risk_metrics.insert_one(metrics.dict(by_alias=True))
            return metrics
        return RiskMetrics(**metrics_data)

    async def update_risk_metrics(
        self, user_id: ObjectId, positions: List[Position], orders: List[Order]
    ) -> RiskMetrics:
        """Update risk metrics based on current positions and orders."""
        # Calculate new metrics
        metrics = await self._calculate_risk_metrics(positions, orders)

        # Update database
        await self.risk_metrics.update_one(
            {"user_id": user_id}, {"$set": metrics.dict(exclude={"id"})}, upsert=True
        )

        return metrics

    async def get_risk_limits(self, user_id: ObjectId) -> RiskLimit:
        """Get risk limits for user."""
        limits_data = await self.risk_limits.find_one({"user_id": user_id})
        if not limits_data:
            # Initialize default limits
            limits = RiskLimit(
                user_id=user_id,
                max_position_size=Decimal("100000"),
                max_single_position_size=Decimal("50000"),
                max_leverage=5.0,
                max_drawdown=20.0,
                max_daily_loss=Decimal("10000"),
                max_portfolio_var=Decimal("50000"),
                max_correlation=0.8,
                min_liquidity_score=60.0,
                max_concentration=20.0,
                max_daily_trades=100,
                max_order_size=Decimal("10000"),
                min_order_size=Decimal("100"),
                max_slippage=1.0,
                trading_hours_start=0,
                trading_hours_end=23,
            )
            await self.risk_limits.insert_one(limits.dict(by_alias=True))
            return limits
        return RiskLimit(**limits_data)

    async def update_risk_limits(self, limits_in: RiskLimit) -> RiskLimit:
        """Update risk limits."""
        # Validate limits
        await self._validate_risk_limits(limits_in)

        # Update database
        result = await self.risk_limits.update_one(
            {"user_id": limits_in.user_id},
            {"$set": limits_in.dict(exclude={"id"})},
            upsert=True,
        )

        if result.modified_count == 0 and not result.upserted_id:
            raise ValidationError("Failed to update risk limits")

        return limits_in

    async def get_risk_profile(self, user_id: ObjectId) -> RiskProfile:
        """Get risk profile for user."""
        profile_data = await self.risk_profiles.find_one({"user_id": user_id})
        if not profile_data:
            # Initialize default profile
            profile = RiskProfile(
                user_id=user_id,
                risk_tolerance=RiskLevel.MEDIUM,
                investment_horizon="MEDIUM_TERM",
                max_drawdown_tolerance=20.0,
                target_annual_return=15.0,
                max_positions=10,
                preferred_position_duration="SWING",
                stop_loss_type="TRAILING",
                take_profit_type="RR_RATIO",
                position_sizing_type="RISK_BASED",
            )
            await self.risk_profiles.insert_one(profile.dict(by_alias=True))
            return profile
        return RiskProfile(**profile_data)

    async def update_risk_profile(
        self, user_id: ObjectId, profile_in: RiskProfile
    ) -> RiskProfile:
        """Update risk profile."""
        # Validate profile
        await self._validate_risk_profile(profile_in)

        # Update database
        result = await self.risk_profiles.update_one(
            {"user_id": user_id}, {"$set": profile_in.dict(exclude={"id"})}, upsert=True
        )

        if result.modified_count == 0 and not result.upserted_id:
            raise ValidationError("Failed to update risk profile")

        return profile_in

    async def create_assessment(
        self, user_id: ObjectId, positions: List[Position], orders: List[Order]
    ) -> RiskAssessment:
        """Create new risk assessment."""
        # Get current metrics and limits
        metrics = await self.update_risk_metrics(user_id, positions, orders)
        limits = await self.get_risk_limits(user_id)

        # Check for limit breaches
        limit_breaches = await self._check_limit_breaches(metrics, limits)

        # Calculate portfolio value
        portfolio_value = sum(
            p.amount * p.current_price for p in positions if p.status == "OPEN"
        )

        # Calculate margin used
        margin_used = sum(
            p.amount * p.current_price / Decimal(str(p.leverage or 1))
            for p in positions
            if p.status == "OPEN"
        )

        # Create assessment
        assessment = RiskAssessment(
            user_id=user_id,
            current_positions=positions,
            open_orders=orders,
            portfolio_value=portfolio_value,
            margin_used=margin_used,
            risk_metrics=metrics,
            limit_breaches=limit_breaches,
            risk_level=self._determine_risk_level(metrics, limit_breaches),
            risk_factors=await self._analyze_risk_factors(positions, orders),
            stress_test_results=await self._run_stress_tests(positions),
            scenario_analysis=await self._analyze_scenarios(positions),
            risk_warnings=self._generate_risk_warnings(limit_breaches),
            suggested_actions=self._generate_suggestions(limit_breaches),
            position_adjustments=self._suggest_position_adjustments(positions, metrics),
        )

        # Save to database
        result = await self.risk_assessments.insert_one(assessment.dict(by_alias=True))
        assessment.id = result.inserted_id

        return assessment

    async def get_assessments(
        self,
        user_id: ObjectId,
        from_time: Optional[datetime] = None,
        to_time: Optional[datetime] = None,
        limit: int = 50,
        skip: int = 0,
    ) -> List[RiskAssessment]:
        """Get risk assessments with filters."""
        # Build query
        query = {"user_id": user_id}
        if from_time or to_time:
            query["created_at"] = {}
            if from_time:
                query["created_at"]["$gte"] = from_time
            if to_time:
                query["created_at"]["$lte"] = to_time

        # Execute query
        cursor = (
            self.risk_assessments.find(query)
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
        )

        assessments = await cursor.to_list(length=limit)
        return [RiskAssessment(**a) for a in assessments]

    async def get_latest_assessment(
        self, user_id: ObjectId
    ) -> Optional[RiskAssessment]:
        """Get latest risk assessment."""
        assessment_data = await self.risk_assessments.find_one(
            {"user_id": user_id}, sort=[("created_at", -1)]
        )
        return RiskAssessment(**assessment_data) if assessment_data else None

    async def _calculate_risk_metrics(
        self, positions: List[Position], orders: List[Order]
    ) -> RiskMetrics:
        """Calculate risk metrics based on positions and orders."""
        # Calculate VaR and other metrics
        # This is a simplified implementation
        portfolio_value = sum(
            p.amount * p.current_price for p in positions if p.status == "OPEN"
        )

        if not portfolio_value:
            return self._get_default_metrics()

        # Calculate position concentration
        max_position_value = max(
            (p.amount * p.current_price for p in positions if p.status == "OPEN"),
            default=0,
        )
        position_concentration = (
            (max_position_value / portfolio_value * 100) if portfolio_value > 0 else 0
        )

        # Calculate leverage ratio
        total_leverage = sum(
            p.amount * p.current_price * Decimal(str(p.leverage or 1))
            for p in positions
            if p.status == "OPEN"
        )
        leverage_ratio = (
            (total_leverage / portfolio_value) if portfolio_value > 0 else 0
        )

        return RiskMetrics(
            var_95=portfolio_value * Decimal("0.05"),  # Simplified VaR
            var_99=portfolio_value * Decimal("0.08"),
            cvar_95=portfolio_value * Decimal("0.07"),
            expected_shortfall=portfolio_value * Decimal("0.06"),
            volatility=20.0,  # Example value
            beta=1.1,
            correlation=0.7,
            position_concentration=float(position_concentration),
            leverage_ratio=float(leverage_ratio),
            margin_usage=60.0,
            liquidity_score=85.0,
            avg_spread=0.1,
            slippage_impact=0.05,
            delta=0.6,
            gamma=0.1,
            vega=0.2,
            theta=-0.1,
            stress_test_loss=portfolio_value * Decimal("0.15"),
            risk_adjusted_return=1.5,
            diversification_score=75.0,
        )

    def _get_default_metrics(self) -> RiskMetrics:
        """Get default risk metrics."""
        return RiskMetrics(
            var_95=Decimal("0"),
            var_99=Decimal("0"),
            cvar_95=Decimal("0"),
            expected_shortfall=Decimal("0"),
            volatility=0,
            beta=0,
            correlation=0,
            position_concentration=0,
            leverage_ratio=0,
            margin_usage=0,
            liquidity_score=100,
            avg_spread=0,
            slippage_impact=0,
            delta=0,
            gamma=0,
            vega=0,
            theta=0,
            stress_test_loss=Decimal("0"),
            risk_adjusted_return=0,
            diversification_score=100,
        )

    async def _check_limit_breaches(
        self, metrics: RiskMetrics, limits: RiskLimit
    ) -> List[Dict[str, Any]]:
        """Check for risk limit breaches."""
        breaches = []

        # Check position concentration
        if metrics.position_concentration > limits.max_concentration:
            breaches.append(
                {
                    "type": "CONCENTRATION",
                    "current": metrics.position_concentration,
                    "limit": limits.max_concentration,
                    "severity": "HIGH",
                }
            )

        # Check leverage
        if metrics.leverage_ratio > limits.max_leverage:
            breaches.append(
                {
                    "type": "LEVERAGE",
                    "current": metrics.leverage_ratio,
                    "limit": limits.max_leverage,
                    "severity": "HIGH",
                }
            )

        # Check liquidity
        if metrics.liquidity_score < limits.min_liquidity_score:
            breaches.append(
                {
                    "type": "LIQUIDITY",
                    "current": metrics.liquidity_score,
                    "limit": limits.min_liquidity_score,
                    "severity": "MEDIUM",
                }
            )

        return breaches

    async def _analyze_risk_factors(
        self, positions: List[Position], orders: List[Order]
    ) -> List[Dict[str, Any]]:
        """Analyze risk factors."""
        risk_factors = []

        # Analyze market exposure
        market_exposure = {}
        for p in positions:
            if p.status == "OPEN":
                market_exposure[p.market_type] = (
                    market_exposure.get(p.market_type, 0) + p.amount * p.current_price
                )

        for market_type, exposure in market_exposure.items():
            risk_factors.append(
                {
                    "type": "MARKET_EXPOSURE",
                    "market": market_type,
                    "exposure": float(exposure),
                    "risk_level": (
                        "HIGH"
                        if market_type in [MarketType.DEX, MarketType.MEME]
                        else "MEDIUM"
                    ),
                }
            )

        # Analyze concentration
        symbols = {}
        for p in positions:
            if p.status == "OPEN":
                symbols[p.symbol] = (
                    symbols.get(p.symbol, 0) + p.amount * p.current_price
                )

        for symbol, amount in symbols.items():
            risk_factors.append(
                {
                    "type": "SYMBOL_CONCENTRATION",
                    "symbol": symbol,
                    "amount": float(amount),
                    "risk_level": "HIGH" if amount > 100000 else "MEDIUM",
                }
            )

        return risk_factors

    async def _run_stress_tests(self, positions: List[Position]) -> Dict[str, Any]:
        """Run stress tests on positions."""
        results = {
            "market_crash": self._simulate_market_crash(positions),
            "volatility_spike": self._simulate_volatility_spike(positions),
            "liquidity_crisis": self._simulate_liquidity_crisis(positions),
            "meme_token_crash": self._simulate_meme_token_crash(positions),
            "social_sentiment_shock": self._simulate_social_sentiment_shock(positions),
            "cross_dex_liquidity_shock": self._simulate_cross_dex_liquidity_shock(positions),
        }
        return results

    def _simulate_meme_token_crash(self, positions: List[Position]) -> Dict[str, Any]:
        """Simulate meme token specific crash scenario."""
        meme_loss = sum(
            p.amount * p.current_price * Decimal("0.8")  # 80% drop for meme tokens
            for p in positions
            if p.status == "OPEN" and p.side == "LONG" and getattr(p, "is_meme", False)
        ) + sum(
            p.amount * p.current_price * Decimal("-0.8")  # 80% gain for meme shorts
            for p in positions
            if p.status == "OPEN" and p.side == "SHORT" and getattr(p, "is_meme", False)
        )
        return {
            "scenario": "MEME_TOKEN_CRASH",
            "price_change": -80,
            "estimated_loss": float(meme_loss),
            "impact_level": "CRITICAL" if meme_loss > 5000 else "HIGH",
        }

    def _simulate_social_sentiment_shock(self, positions: List[Position]) -> Dict[str, Any]:
        """Simulate social sentiment driven price shock."""
        sentiment_impact = sum(
            p.amount * p.current_price * Decimal("0.5")  # 50% drop on negative sentiment
            for p in positions
            if p.status == "OPEN" and p.side == "LONG" and getattr(p, "is_meme", False)
        ) + sum(
            p.amount * p.current_price * Decimal("-0.5")  # 50% gain on negative sentiment shorts
            for p in positions
            if p.status == "OPEN" and p.side == "SHORT" and getattr(p, "is_meme", False)
        )
        return {
            "scenario": "SOCIAL_SENTIMENT_SHOCK",
            "sentiment_change": "EXTREMELY_NEGATIVE",
            "estimated_loss": float(sentiment_impact),
            "impact_level": "HIGH" if sentiment_impact > 10000 else "MEDIUM",
        }

    def _simulate_cross_dex_liquidity_shock(self, positions: List[Position]) -> Dict[str, Any]:
        """Simulate cross-DEX liquidity shock scenario."""
        liquidity_impact = sum(
            p.amount * p.current_price * Decimal("0.25")  # 25% slippage due to liquidity shock
            for p in positions
            if p.status == "OPEN" and p.side == "LONG" and getattr(p, "is_meme", False)
        ) + sum(
            p.amount * p.current_price * Decimal("-0.25")  # 25% slippage gain for shorts
            for p in positions
            if p.status == "OPEN" and p.side == "SHORT" and getattr(p, "is_meme", False)
        )
        return {
            "scenario": "CROSS_DEX_LIQUIDITY_SHOCK",
            "liquidity_change": -90,  # 90% liquidity reduction
            "estimated_loss": float(liquidity_impact),
            "impact_level": "HIGH" if liquidity_impact > 7500 else "MEDIUM",
        }

    def _simulate_market_crash(self, positions: List[Position]) -> Dict[str, Any]:
        """Simulate market crash scenario."""
        total_loss = sum(
            p.amount * p.current_price * Decimal("0.3")  # 30% market drop
            for p in positions
            if p.status == "OPEN" and p.side == "LONG"
        ) + sum(
            p.amount * p.current_price * Decimal("-0.3")  # 30% gain for shorts
            for p in positions
            if p.status == "OPEN" and p.side == "SHORT"
        )
        return {
            "scenario": "MARKET_CRASH",
            "price_change": -30,
            "estimated_loss": float(total_loss),
            "survival_probability": "HIGH" if total_loss < 50000 else "MEDIUM",
        }

    def _simulate_volatility_spike(self, positions: List[Position]) -> Dict[str, Any]:
        """Simulate volatility spike scenario."""
        var_increase = sum(
            p.amount * p.current_price * Decimal("0.15")  # 15% VaR increase
            for p in positions
            if p.status == "OPEN" and p.side == "LONG"
        ) + sum(
            p.amount * p.current_price * Decimal("-0.15")  # 15% VaR decrease for shorts
            for p in positions
            if p.status == "OPEN" and p.side == "SHORT"
        )
        return {
            "scenario": "VOLATILITY_SPIKE",
            "var_increase": 15,
            "risk_increase": float(var_increase),
            "impact_level": "HIGH" if var_increase > 25000 else "MEDIUM",
        }

    def _simulate_liquidity_crisis(self, positions: List[Position]) -> Dict[str, Any]:
        """Simulate liquidity crisis scenario."""
        slippage_loss = sum(
            p.amount * p.current_price * Decimal("0.05")  # 5% slippage
            for p in positions
            if p.status == "OPEN" and p.side == "LONG"
        ) + sum(
            p.amount * p.current_price * Decimal("-0.05")  # 5% slippage gain for shorts
            for p in positions
            if p.status == "OPEN" and p.side == "SHORT"
        )
        return {
            "scenario": "LIQUIDITY_CRISIS",
            "slippage": 5,
            "estimated_loss": float(slippage_loss),
            "impact_level": "HIGH" if slippage_loss > 10000 else "MEDIUM",
        }

    async def _analyze_scenarios(self, positions: List[Position]) -> Dict[str, Any]:
        """Analyze different market scenarios."""
        return {
            "bull_market": self._analyze_bull_scenario(positions),
            "bear_market": self._analyze_bear_scenario(positions),
            "sideways_market": self._analyze_sideways_scenario(positions),
        }

    def _analyze_bull_scenario(self, positions: List[Position]) -> Dict[str, Any]:
        """Analyze bull market scenario."""
        potential_gain = sum(
            p.amount * p.current_price * Decimal("0.2")  # 20% price increase
            for p in positions
            if p.status == "OPEN" and p.side == "LONG"
        )
        return {
            "scenario": "BULL_MARKET",
            "price_change": 20,
            "potential_gain": float(potential_gain),
            "opportunity_level": "HIGH" if potential_gain > 20000 else "MEDIUM",
        }

    def _analyze_bear_scenario(self, positions: List[Position]) -> Dict[str, Any]:
        """Analyze bear market scenario."""
        potential_loss = sum(
            p.amount * p.current_price * Decimal("0.2")  # 20% price decrease
            for p in positions
            if p.status == "OPEN" and p.side == "LONG"
        )
        return {
            "scenario": "BEAR_MARKET",
            "price_change": -20,
            "potential_loss": float(potential_loss),
            "risk_level": "HIGH" if potential_loss > 20000 else "MEDIUM",
        }

    def _analyze_sideways_scenario(self, positions: List[Position]) -> Dict[str, Any]:
        """Analyze sideways market scenario."""
        theta_decay = sum(
            p.amount * p.current_price * Decimal("0.01")  # 1% theta decay
            for p in positions
            if p.status == "OPEN"
        )
        return {
            "scenario": "SIDEWAYS_MARKET",
            "price_change": 0,
            "theta_decay": float(theta_decay),
            "impact_level": "MEDIUM",
        }

    def _determine_risk_level(
        self, metrics: RiskMetrics, limit_breaches: List[Dict[str, Any]]
    ) -> RiskLevel:
        """Determine overall risk level."""
        if any(b["severity"] == "HIGH" for b in limit_breaches):
            return RiskLevel.HIGH

        if metrics.leverage_ratio > 3 or metrics.position_concentration > 50:
            return RiskLevel.HIGH

        if metrics.leverage_ratio > 2 or metrics.position_concentration > 30:
            return RiskLevel.MEDIUM

        return RiskLevel.LOW

    def _generate_risk_warnings(
        self, limit_breaches: List[Dict[str, Any]]
    ) -> List[str]:
        """Generate risk warnings based on limit breaches."""
        warnings = []
        for breach in limit_breaches:
            warnings.append(
                f"{breach['type']} limit breach: "
                f"Current {breach['current']:.2f} > Limit {breach['limit']:.2f}"
            )
        return warnings

    def _generate_suggestions(self, limit_breaches: List[Dict[str, Any]]) -> List[str]:
        """Generate suggestions based on limit breaches."""
        suggestions = []
        for breach in limit_breaches:
            if breach["type"] == "CONCENTRATION":
                suggestions.append(
                    "Consider reducing position sizes to improve diversification"
                )
            elif breach["type"] == "LEVERAGE":
                suggestions.append(
                    "Consider reducing leverage to decrease risk exposure"
                )
            elif breach["type"] == "LIQUIDITY":
                suggestions.append(
                    "Consider trading more liquid markets or reducing position sizes"
                )
        return suggestions

    def _suggest_position_adjustments(
        self, positions: List[Position], metrics: RiskMetrics
    ) -> List[Dict[str, Any]]:
        """Suggest position adjustments."""
        adjustments = []

        # Check for high concentration positions
        for position in positions:
            if position.status == "OPEN":
                position_value = position.amount * position.current_price
                if position_value > Decimal("50000"):
                    adjustments.append(
                        {
                            "position_id": str(position.id),
                            "symbol": position.symbol,
                            "current_size": float(position_value),
                            "suggested_size": float(position_value * Decimal("0.7")),
                            "reason": "High position concentration",
                        }
                    )

        # Check for high leverage positions
        for position in positions:
            if (
                position.status == "OPEN"
                and position.leverage
                and position.leverage > 3
            ):
                adjustments.append(
                    {
                        "position_id": str(position.id),
                        "symbol": position.symbol,
                        "current_leverage": position.leverage,
                        "suggested_leverage": 2,
                        "reason": "High leverage risk",
                    }
                )

        return adjustments
