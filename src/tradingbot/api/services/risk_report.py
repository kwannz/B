"""
Risk report service for generating interactive reports
"""

import json
import logging
import os
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from jinja2 import Environment, FileSystemLoader
from plotly.subplots import make_subplots

from ..core.exceptions import RiskError
from ..models.trading import OrderSide, Position
from .market import MarketDataService
from .risk import RiskManager
from .risk_analytics import RiskAnalytics
from .risk_attribution import RiskAttribution

logger = logging.getLogger(__name__)


class RiskReport:
    """Interactive risk report generation system."""

    def __init__(
        self,
        db: Database,
        market_service: MarketDataService,
        risk_manager: RiskManager,
        risk_analytics: RiskAnalytics,
        risk_attribution: RiskAttribution,
        template_path: str = "templates",
        report_path: str = "reports",
    ):
        """Initialize risk report generator."""
        self.db = db
        self.market_service = market_service
        self.risk_manager = risk_manager
        self.risk_analytics = risk_analytics
        self.risk_attribution = risk_attribution

        # Initialize template engine
        self.template_env = Environment(loader=FileSystemLoader(template_path))

        # Ensure report directory exists
        self.report_path = report_path
        os.makedirs(report_path, exist_ok=True)

    async def generate_report(
        self,
        user_id: str,
        report_type: str = "full",
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        format: str = "html",
    ) -> str:
        """Generate interactive risk report."""
        # Get report data
        data = await self._collect_report_data(
            user_id, report_type, start_date, end_date
        )

        # Generate visualizations
        plots = self._generate_plots(data)

        # Create report
        if format == "html":
            return await self._generate_html_report(data, plots)
        elif format == "pdf":
            return await self._generate_pdf_report(data, plots)
        else:
            raise ValueError(f"Unsupported format: {format}")

    async def _collect_report_data(
        self,
        user_id: str,
        report_type: str,
        start_date: Optional[datetime],
        end_date: Optional[datetime],
    ) -> Dict[str, Any]:
        """Collect data for report."""
        data = {
            "timestamp": datetime.utcnow(),
            "user_id": user_id,
            "report_type": report_type,
        }

        # Get user information
        user = await self.db.users.find_one({"_id": user_id})
        data["user"] = user

        # Get current portfolio state
        data["portfolio"] = await self._get_portfolio_data(user_id)

        # Get risk metrics
        data["risk_metrics"] = await self.risk_analytics.calculate_advanced_metrics(
            user_id
        )

        # Get risk attribution
        data["risk_attribution"] = await self.risk_attribution.analyze_risk_sources(
            user_id
        )

        # Get performance attribution
        data[
            "performance"
        ] = await self.risk_attribution.analyze_performance_attribution(
            user_id, start_date, end_date
        )

        # Get historical data
        data["history"] = await self._get_historical_data(user_id, start_date, end_date)

        # Get predictions
        data["predictions"] = await self.risk_manager.predict_risk_metrics(user_id)

        return data

    def _generate_plots(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate interactive plots."""
        plots = {}

        # Portfolio composition
        plots["composition"] = self._plot_portfolio_composition(data["portfolio"])

        # Risk metrics
        plots["risk_metrics"] = self._plot_risk_metrics(data["risk_metrics"])

        # Risk attribution
        plots["risk_attribution"] = self._plot_risk_attribution(
            data["risk_attribution"]
        )

        # Performance attribution
        plots["performance"] = self._plot_performance_attribution(data["performance"])

        # Historical analysis
        plots["history"] = self._plot_historical_analysis(data["history"])

        # Predictions
        plots["predictions"] = self._plot_predictions(data["predictions"])

        return plots

    def _plot_portfolio_composition(
        self, portfolio_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate portfolio composition plots."""
        plots = {}

        # Asset allocation pie chart
        fig = go.Figure(
            data=[
                go.Pie(
                    labels=list(portfolio_data["weights"].keys()),
                    values=list(portfolio_data["weights"].values()),
                    hole=0.3,
                )
            ]
        )
        fig.update_layout(title="Portfolio Composition")
        plots["allocation"] = fig.to_json()

        # Risk contribution treemap
        fig = px.treemap(
            names=list(portfolio_data["risk_contribution"].keys()),
            parents=[""] * len(portfolio_data["risk_contribution"]),
            values=list(portfolio_data["risk_contribution"].values()),
        )
        fig.update_layout(title="Risk Contribution")
        plots["risk_contribution"] = fig.to_json()

        return plots

    def _plot_risk_metrics(self, risk_metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Generate risk metrics plots."""
        plots = {}

        # Risk metrics radar chart
        metrics = ["volatility", "var", "cvar", "sharpe_ratio", "sortino_ratio"]

        fig = go.Figure(
            data=go.Scatterpolar(
                r=[risk_metrics.get(m, 0) for m in metrics],
                theta=metrics,
                fill="toself",
            )
        )
        fig.update_layout(title="Risk Metrics")
        plots["metrics_radar"] = fig.to_json()

        return plots

    def _plot_risk_attribution(
        self, attribution_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate risk attribution plots."""
        plots = {}

        # Factor contribution stacked bar
        factors = attribution_data["factor_attribution"]
        fig = go.Figure(
            data=[
                go.Bar(name=factor, x=["Contribution"], y=[data["contribution"]])
                for factor, data in factors.items()
            ]
        )
        fig.update_layout(title="Factor Attribution", barmode="stack")
        plots["factor_contribution"] = fig.to_json()

        # Style analysis
        styles = attribution_data["style_attribution"]
        fig = go.Figure(
            data=[
                go.Bar(
                    name=style,
                    x=["Exposure", "Contribution"],
                    y=[data["exposure"], data["contribution"]],
                )
                for style, data in styles.items()
            ]
        )
        fig.update_layout(title="Style Analysis")
        plots["style_analysis"] = fig.to_json()

        return plots

    def _plot_performance_attribution(
        self, performance_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate performance attribution plots."""
        plots = {}

        # Performance decomposition waterfall
        effects = ["selection", "allocation", "interaction", "trading"]

        values = [sum(performance_data[effect].values()) for effect in effects]

        fig = go.Figure(
            go.Waterfall(
                name="Performance Attribution",
                orientation="v",
                measure=["relative"] * len(effects),
                x=effects,
                y=values,
            )
        )
        fig.update_layout(title="Performance Attribution")
        plots["performance_waterfall"] = fig.to_json()

        return plots

    def _plot_historical_analysis(
        self, historical_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate historical analysis plots."""
        plots = {}

        # Equity curve
        fig = go.Figure(
            data=[
                go.Scatter(
                    x=historical_data["dates"],
                    y=historical_data["equity"],
                    name="Portfolio Value",
                )
            ]
        )
        fig.update_layout(title="Equity Curve")
        plots["equity_curve"] = fig.to_json()

        # Drawdown chart
        fig = go.Figure(
            data=[
                go.Scatter(
                    x=historical_data["dates"],
                    y=historical_data["drawdown"],
                    name="Drawdown",
                    fill="tozeroy",
                )
            ]
        )
        fig.update_layout(title="Drawdown")
        plots["drawdown"] = fig.to_json()

        return plots

    def _plot_predictions(self, prediction_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate prediction plots."""
        plots = {}

        # Risk metric predictions
        fig = make_subplots(rows=3, cols=1)

        for i, metric in enumerate(["var", "volatility", "correlation"], 1):
            fig.add_trace(
                go.Scatter(
                    x=list(range(len(prediction_data[metric]))),
                    y=prediction_data[metric],
                    name=metric.title(),
                ),
                row=i,
                col=1,
            )

        fig.update_layout(height=900, title="Risk Metric Predictions")
        plots["predictions"] = fig.to_json()

        return plots

    async def _generate_html_report(
        self, data: Dict[str, Any], plots: Dict[str, Any]
    ) -> str:
        """Generate HTML report."""
        template = self.template_env.get_template("risk_report.html")

        html = template.render(data=data, plots=plots, timestamp=datetime.utcnow())

        # Save report
        report_file = os.path.join(
            self.report_path,
            f"risk_report_{data['user_id']}_{data['timestamp'].strftime('%Y%m%d_%H%M%S')}.html",
        )

        with open(report_file, "w") as f:
            f.write(html)

        return report_file

    async def _generate_pdf_report(
        self, data: Dict[str, Any], plots: Dict[str, Any]
    ) -> str:
        """Generate PDF report."""
        # First generate HTML
        html_file = await self._generate_html_report(data, plots)

        # Convert to PDF
        pdf_file = html_file.replace(".html", ".pdf")

        # Use a PDF conversion library here
        # For example: pdfkit, weasyprint, etc.

        return pdf_file

    async def _get_portfolio_data(self, user_id: str) -> Dict[str, Any]:
        """Get current portfolio data."""
        positions = await self.db.positions.find(
            {"user_id": user_id, "status": "open"}
        ).to_list(None)

        if not positions:
            return {"positions": [], "weights": {}, "risk_contribution": {}}

        # Calculate weights
        total_value = sum(
            float(p["amount"]) * float(p["current_price"]) for p in positions
        )

        weights = {
            p["symbol"]: float(p["amount"]) * float(p["current_price"]) / total_value
            for p in positions
        }

        # Get risk contribution
        returns_data, _ = await self.risk_analytics._get_position_data(positions)
        risk_contribution = await self.risk_attribution._calculate_component_var(
            returns_data, weights
        )

        return {
            "positions": positions,
            "weights": weights,
            "risk_contribution": risk_contribution,
        }

    async def _get_historical_data(
        self, user_id: str, start_date: Optional[datetime], end_date: Optional[datetime]
    ) -> Dict[str, Any]:
        """Get historical portfolio data."""
        # Get position history
        query = {"user_id": user_id, "status": {"$in": ["open", "closed"]}}

        if start_date:
            query["created_at"] = {"$gte": start_date}
        if end_date:
            query["closed_at"] = {"$lte": end_date}

        positions = await self.db.positions.find(query).to_list(None)

        if not positions:
            return {"dates": [], "equity": [], "drawdown": []}

        # Calculate daily equity curve
        dates = pd.date_range(
            start=min(p["created_at"] for p in positions),
            end=max(p.get("closed_at", datetime.utcnow()) for p in positions),
            freq="D",
        )

        equity = []
        high_water_mark = 0
        drawdown = []

        for date in dates:
            # Calculate portfolio value at date
            value = sum(
                float(p["amount"]) * float(p["current_price"])
                for p in positions
                if p["created_at"] <= date
                and (p["status"] == "open" or p["closed_at"] > date)
            )

            equity.append(value)

            # Calculate drawdown
            high_water_mark = max(high_water_mark, value)
            if high_water_mark > 0:
                drawdown.append((high_water_mark - value) / high_water_mark)
            else:
                drawdown.append(0.0)

        return {"dates": dates.tolist(), "equity": equity, "drawdown": drawdown}
