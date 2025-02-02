"""
Monitoring service for system metrics and performance tracking
"""

from datetime import datetime
from typing import List, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from ..models.monitoring import (
    Alert,
    AlertPriority,
    AlertStatus,
    AlertType,
    HealthCheck,
    MonitoringReport,
    PerformanceMetrics,
    SystemMetrics,
    TradingMetrics,
)

class MonitoringService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.alerts_collection = db.alerts
        self.metrics_collection = db.metrics
        self.health_collection = db.health_checks

    async def get_system_metrics(self) -> SystemMetrics:
        metrics = await self.metrics_collection.find_one(
            {"type": "system"},
            sort=[("timestamp", -1)]
        )
        return SystemMetrics(**metrics) if metrics else SystemMetrics()

    async def get_trading_metrics(self, user_id: str) -> TradingMetrics:
        metrics = await self.metrics_collection.find_one(
            {"type": "trading", "user_id": ObjectId(user_id)},
            sort=[("timestamp", -1)]
        )
        return TradingMetrics(**metrics) if metrics else TradingMetrics()

    async def get_performance_metrics(
        self,
        user_id: str,
        from_time: Optional[datetime] = None,
        to_time: Optional[datetime] = None
    ) -> PerformanceMetrics:
        query = {"type": "performance", "user_id": ObjectId(user_id)}
        if from_time:
            query["timestamp"] = {"$gte": from_time}
        if to_time:
            query.setdefault("timestamp", {})["$lte"] = to_time

        metrics = await self.metrics_collection.find_one(
            query,
            sort=[("timestamp", -1)]
        )
        return PerformanceMetrics(**metrics) if metrics else PerformanceMetrics()

    async def get_health_status(self) -> List[HealthCheck]:
        cursor = self.health_collection.find().sort("timestamp", -1).limit(10)
        health_checks = await cursor.to_list(length=10)
        return [HealthCheck(**check) for check in health_checks]

    async def get_alerts(
        self,
        user_id: str,
        type: Optional[AlertType] = None,
        status: Optional[AlertStatus] = None,
        priority: Optional[AlertPriority] = None,
        is_active: Optional[bool] = True,
        from_time: Optional[datetime] = None,
        to_time: Optional[datetime] = None,
        limit: int = 50,
        skip: int = 0,
    ) -> List[Alert]:
        query = {"user_id": ObjectId(user_id)}
        if type:
            query["type"] = type
        if status:
            query["status"] = status
        if priority:
            query["priority"] = priority
        if is_active is not None:
            query["is_active"] = is_active
        if from_time:
            query["created_at"] = {"$gte": from_time}
        if to_time:
            query.setdefault("created_at", {})["$lte"] = to_time

        cursor = self.alerts_collection.find(query).sort(
            "created_at", -1
        ).skip(skip).limit(limit)
        alerts = await cursor.to_list(length=limit)
        return [Alert(**alert) for alert in alerts]

    async def get_alert(self, alert_id: str) -> Optional[Alert]:
        alert = await self.alerts_collection.find_one({"_id": ObjectId(alert_id)})
        return Alert(**alert) if alert else None

    async def acknowledge_alert(self, alert_id: str) -> Alert:
        update = {
            "$set": {
                "status": AlertStatus.ACKNOWLEDGED,
                "updated_at": datetime.utcnow()
            }
        }
        alert = await self.alerts_collection.find_one_and_update(
            {"_id": ObjectId(alert_id)},
            update,
            return_document=True
        )
        return Alert(**alert)

    async def generate_report(
        self,
        user_id: str,
        system_metrics: Optional[SystemMetrics],
        trading_metrics: TradingMetrics,
        performance_metrics: PerformanceMetrics,
        risk_metrics: dict,
        alerts: List[Alert],
    ) -> MonitoringReport:
        return MonitoringReport(
            user_id=user_id,
            system_metrics=system_metrics,
            trading_metrics=trading_metrics,
            performance_metrics=performance_metrics,
            risk_metrics=risk_metrics,
            alerts=alerts,
            generated_at=datetime.utcnow()
        )
