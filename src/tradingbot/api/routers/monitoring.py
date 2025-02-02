"""
Monitoring router for system metrics and performance tracking
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import asyncio
from fastapi import APIRouter, Depends, Path, Query, WebSocket, WebSocketDisconnect
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..core.deps import get_current_user, get_database
from ..core.exceptions import NotFoundError, ValidationError
from ..models.trading import OrderStatus, PositionStatus
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
from ..models.user import User
from ..services.monitoring import MonitoringService
from ..services.risk import RiskManagementService
from ..services.trading import TradingService

router = APIRouter()


# Dependencies
async def get_monitoring_service(
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> MonitoringService:
    """Get monitoring service instance."""
    return MonitoringService(db)


async def get_trading_service(
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> TradingService:
    """Get trading service instance."""
    return TradingService(db)


async def get_risk_service(
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> RiskManagementService:
    """Get risk management service instance."""
    return RiskManagementService(db)


@router.get("/system/metrics", response_model=SystemMetrics)
async def get_system_metrics(
    current_user: User = Depends(get_current_user),
    monitoring_service: MonitoringService = Depends(get_monitoring_service),
):
    """Get current system metrics."""
    if not current_user.is_admin:
        raise ValidationError("Only admin users can access system metrics")
    return await monitoring_service.get_system_metrics()


@router.get("/trading/metrics", response_model=TradingMetrics)
async def get_trading_metrics(
    current_user: User = Depends(get_current_user),
    monitoring_service: MonitoringService = Depends(get_monitoring_service),
    trading_service: TradingService = Depends(get_trading_service),
):
    """Get trading metrics for user."""
    # Get trading metrics
    metrics = await monitoring_service.get_trading_metrics(current_user.id)

    # Enrich with current positions and orders
    positions = await trading_service.get_positions(
        user_id=current_user.id, status=PositionStatus.OPEN
    )
    orders = await trading_service.get_orders(
        user_id=current_user.id, status=OrderStatus.PENDING | OrderStatus.OPEN
    )

    metrics.active_positions = len(positions)
    metrics.pending_orders = len(orders)

    return metrics


@router.get("/performance/metrics", response_model=PerformanceMetrics)
async def get_performance_metrics(
    from_time: Optional[datetime] = None,
    to_time: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    monitoring_service: MonitoringService = Depends(get_monitoring_service),
):
    """Get performance metrics for user."""
    return await monitoring_service.get_performance_metrics(
        user_id=current_user.id, from_time=from_time, to_time=to_time
    )


@router.get("/health", response_model=List[HealthCheck])
async def get_health_status(
    current_user: User = Depends(get_current_user),
    monitoring_service: MonitoringService = Depends(get_monitoring_service),
):
    """Get system health status."""
    if not current_user.is_admin:
        raise ValidationError("Only admin users can access health status")
    return await monitoring_service.get_health_status()


@router.get("/report", response_model=MonitoringReport)
async def get_monitoring_report(
    from_time: Optional[datetime] = None,
    to_time: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    monitoring_service: MonitoringService = Depends(get_monitoring_service),
    trading_service: TradingService = Depends(get_trading_service),
    risk_service: RiskManagementService = Depends(get_risk_service),
):
    """Get comprehensive monitoring report."""
    # Get system metrics if admin
    system_metrics = None
    if current_user.is_admin:
        system_metrics = await monitoring_service.get_system_metrics()

    # Get trading metrics
    trading_metrics = await monitoring_service.get_trading_metrics(current_user.id)

    # Get performance metrics
    performance_metrics = await monitoring_service.get_performance_metrics(
        user_id=current_user.id, from_time=from_time, to_time=to_time
    )

    # Get risk metrics
    risk_metrics = await risk_service.get_risk_metrics(current_user.id)

    # Get active alerts
    alerts = await monitoring_service.get_alerts(
        user_id=current_user.id, is_active=True
    )

    return await monitoring_service.generate_report(
        user_id=current_user.id,
        system_metrics=system_metrics,
        trading_metrics=trading_metrics,
        performance_metrics=performance_metrics,
        risk_metrics=risk_metrics,
        alerts=alerts,
    )


@router.websocket("/ws/metrics")
async def websocket_metrics(
    websocket: WebSocket,
    current_user: User = Depends(get_current_user),
    monitoring_service: MonitoringService = Depends(get_monitoring_service),
):
    """WebSocket endpoint for real-time metrics updates."""
    await websocket.accept()
    try:
        while True:
            # Get latest metrics
            trading_metrics = await monitoring_service.get_trading_metrics(
                current_user.id
            )
            performance_metrics = await monitoring_service.get_performance_metrics(
                user_id=current_user.id
            )

            # Send metrics update
            await websocket.send_json(
                {
                    "trading_metrics": trading_metrics.model_dump(),
                    "performance_metrics": performance_metrics.model_dump(),
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )

            # Wait for next update
            await asyncio.sleep(5)  # Update every 5 seconds

    except WebSocketDisconnect:
        pass
    finally:
        await websocket.close()


@router.get("/alerts", response_model=List[Alert])
async def get_alerts(
    type: Optional[AlertType] = None,
    status: Optional[AlertStatus] = None,
    priority: Optional[AlertPriority] = None,
    is_active: Optional[bool] = True,
    from_time: Optional[datetime] = None,
    to_time: Optional[datetime] = None,
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    monitoring_service: MonitoringService = Depends(get_monitoring_service),
):
    """Get monitoring alerts."""
    return await monitoring_service.get_alerts(
        user_id=current_user.id,
        type=type,
        status=status,
        priority=priority,
        is_active=is_active,
        from_time=from_time,
        to_time=to_time,
        limit=limit,
        skip=skip,
    )


@router.post("/alerts/{alert_id}/acknowledge", response_model=Alert)
async def acknowledge_alert(
    alert_id: str = Path(..., title="Alert ID"),
    current_user: User = Depends(get_current_user),
    monitoring_service: MonitoringService = Depends(get_monitoring_service),
):
    """Acknowledge monitoring alert."""
    alert = await monitoring_service.get_alert(alert_id)
    if not alert:
        raise NotFoundError("Alert not found")

    if alert.user_id != current_user.id:
        raise ValidationError("Alert does not belong to user")

    return await monitoring_service.acknowledge_alert(alert_id)
