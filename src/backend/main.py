import logging
from datetime import datetime
from typing import Any, Dict

from fastapi import Depends, FastAPI, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from decimal import Decimal
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient

from tradingbot.api.core.config import settings

def calculate_trade_profit(trade) -> float:
    """Calculate profit for a trade with proper type handling."""
    try:
        if not all([
            isinstance(trade.exit_price, (float, int, Decimal)),
            isinstance(trade.entry_price, (float, int, Decimal)),
            isinstance(trade.quantity, (float, int, Decimal))
        ]):
            return 0.0

        exit_price = float(trade.exit_price)
        entry_price = float(trade.entry_price)
        quantity = float(trade.quantity)

        return (
            (exit_price - entry_price)
            if trade.direction == "long"
            else (entry_price - exit_price)
        ) * quantity
    except (TypeError, ValueError, AttributeError):
        return 0.0
from tradingbot.api.models.trading import (
    Order,
    OrderBase,
    OrderCreate,
    OrderSide,
    OrderStatus,
    OrderType,
    Position,
    PositionSide,
    PositionStatus,
    TradeStatus,
)
from tradingbot.api.models.trade import Trade, TradeCreate
from tradingbot.api.models.risk import (
    RiskMetrics,
    LimitSettings,
    LimitSettingsUpdate,
)
from tradingbot.api.models.base import PyObjectId
from tradingbot.api.models.market import MarketData
from tradingbot.api.models.user import Account
from tradingbot.api.models.agent import Agent, AgentCreate, AgentStatus
from tradingbot.api.models.signal import Signal, SignalCreate
from tradingbot.api.models.strategy import Strategy, StrategyCreate
from tradingbot.api.core.deps import (
    get_db,
    init_db,
    init_mongodb,
    get_mongodb,
)
from tradingbot.api.routes import swap
from tradingbot.api.services.responses import (
    AccountResponse,
    AgentListResponse,
    AgentResponse,
    LimitSettingsResponse,
    OrderListResponse,
    OrderResponse,
    PerformanceResponse,
    PositionListResponse,
    RiskMetricsResponse,
    SignalListResponse,
    SignalResponse,
    StrategyListResponse,
    StrategyResponse,
    TradeListResponse,
    TradeResponse,
)
HAS_AI_MODEL = False
try:
    from tradingbot.backend.ai_model import AIModel
    HAS_AI_MODEL = True
except ImportError:
    AIModel = None
from tradingbot.api.websocket.handler import (
    broadcast_limit_update,
    broadcast_order_update,
    broadcast_performance_update,
    broadcast_position_update,
    broadcast_risk_update,
    broadcast_signal,
    broadcast_trade_update,
    handle_websocket,
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> Dict[str, Any]:
    try:
        # In a real application, you would decode and verify the JWT token
        # For now, we'll return a mock user
        return {"id": "test_user", "username": "test"}
    except Exception as e:
        logger.error(f"Error authenticating user: {e}")
        raise HTTPException(
            status_code=401,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


import os
import asyncio
import logging
import motor.motor_asyncio
from datetime import datetime
from fastapi import FastAPI, WebSocket, HTTPException
from contextlib import asynccontextmanager
from tradingbot.api.core.deps import get_db, init_db, init_mongodb, get_mongodb
from tradingbot.api.monitoring.service import monitoring_service

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

@asynccontextmanager
async def lifespan(app: FastAPI):
    monitoring_service = None
    try:
        logger.info("Initializing MongoDB connection...")
        app.state.mongo_client = motor.motor_asyncio.AsyncIOMotorClient(
            os.getenv("MONGODB_URL", "mongodb://localhost:27017"),
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            socketTimeoutMS=5000
        )
        await app.state.mongo_client.admin.command('ping')
        app.state.db = app.state.mongo_client.tradingbot
        
        # Start monitoring service
        logger.info("Starting monitoring service...")
        from tradingbot.api.monitoring.service import MonitoringService
        monitoring_service = MonitoringService()
        await monitoring_service.start()
        
        logger.info("All services initialized successfully")
        yield
    except Exception as e:
        logger.error(f"Service initialization error: {e}")
        raise
    finally:
        logger.info("Cleaning up services...")
        if hasattr(app.state, 'mongo_client'):
            app.state.mongo_client.close()
        if monitoring_service:
            await monitoring_service.stop()

app = FastAPI(lifespan=lifespan)

# Include routers
app.include_router(swap.router, prefix="/api/v1/swap", tags=["swap"])

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Market Analysis endpoint
@app.post("/api/v1/analysis")
async def analyze_market(market_data: MarketData) -> dict:
    try:
        logger.info(f"Received market data for analysis: {market_data.symbol}")
        analysis = {"status": "AI model not available"}
        if HAS_AI_MODEL and AIModel is not None:
            try:
                model = AIModel()
                analysis_request = {
                    "symbol": market_data.symbol,
                    "price": market_data.price,
                    "volume": market_data.volume,
                    "indicators": market_data.metadata.get("indicators", {}),
                }
                analysis = await model.analyze_data(analysis_request)
            except Exception as model_err:
                logger.error(f"Model error: {model_err}")
                analysis = {"status": "AI model error", "error": str(model_err)}

        try:
            db = await get_mongodb()
            await db.market_snapshots.insert_one(market_data.model_dump())
            await db.technical_analysis.insert_one(
                {
                    "symbol": market_data.symbol,
                    "timestamp": datetime.utcnow(),
                    "analysis": analysis,
                    "market_data": market_data.model_dump(),
                }
            )
        except Exception as store_err:
            logger.error(f"Storage error: {store_err}")

        return {
            "status": "success",
            "data": analysis,
            "timestamp": datetime.utcnow().isoformat(),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Health check endpoint
@app.get("/api/v1/health")
async def health_check() -> dict:
    try:
        # Test MongoDB connection
        await app.state.mongo_client.admin.command('ping')
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "database": "connected",
            "version": "1.0.0",
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")


# WebSocket endpoints
@app.websocket("/ws/trades")
async def websocket_trades(websocket: WebSocket) -> None:
    await handle_websocket(websocket, "trades")


@app.websocket("/ws/signals")
async def websocket_signals(websocket: WebSocket) -> None:
    await handle_websocket(websocket, "signals")


@app.websocket("/ws/performance")
async def websocket_performance(websocket: WebSocket) -> None:
    await handle_websocket(websocket, "performance")


@app.websocket("/ws/analysis")
async def websocket_analysis(websocket: WebSocket) -> None:
    await handle_websocket(websocket, "analysis")


@app.get("/api/v1/account/balance", response_model=AccountResponse)
async def get_account_balance(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> AccountResponse:
    try:
        account = await app.state.db.accounts.find_one({"user_id": current_user["id"]})
        if not account:
            account = {"user_id": current_user["id"], "balance": 0.0}
            await app.state.db.accounts.insert_one(account)
        return AccountResponse(**account)
    except Exception as e:
        logger.error(f"Error fetching account balance: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch balance")


@app.get("/api/v1/account/positions", response_model=PositionListResponse)
async def get_account_positions(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> PositionListResponse:
    try:
        positions = await app.state.db.positions.find(
            {"user_id": current_user["id"]}
        ).to_list(None)

        # Broadcast position updates via WebSocket
        for position in positions:
            await broadcast_position_update(position)

        return PositionListResponse(positions=positions)
    except Exception as e:
        logger.error(f"Error fetching positions: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch positions")


@app.websocket("/ws/positions")
async def websocket_positions(websocket: WebSocket) -> None:
    await handle_websocket(websocket, "positions")


@app.websocket("/ws/orders")
async def websocket_orders(websocket: WebSocket) -> None:
    await handle_websocket(websocket, "orders")


@app.post("/api/v1/orders", response_model=OrderResponse)
async def create_order(
    order: OrderCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> OrderResponse:
    try:
        order_data = order.model_dump()
        order_data["user_id"] = current_user["id"]
        order_data["created_at"] = datetime.utcnow()
        
        result = await app.state.db.orders.insert_one(order_data)
        order_data["id"] = str(result.inserted_id)
        
        await broadcast_order_update(order_data)
        return OrderResponse(**order_data)
    except Exception as e:
        logger.error(f"Error creating order: {e}")
        raise HTTPException(status_code=500, detail="Failed to create order")


@app.get("/api/v1/orders", response_model=OrderListResponse)
async def list_orders(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> OrderListResponse:
    try:
        orders = await app.state.db.orders.find(
            {"user_id": current_user["id"]}
        ).to_list(None)
        return OrderListResponse(orders=orders)
    except Exception as e:
        logger.error(f"Error listing orders: {e}")
        raise HTTPException(status_code=500, detail="Failed to list orders")


@app.get("/api/v1/orders/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> OrderResponse:
    try:
        from bson import ObjectId
        order = await app.state.db.orders.find_one({
            "_id": ObjectId(order_id),
            "user_id": current_user["id"]
        })
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        order["id"] = str(order["_id"])
        return OrderResponse(**order)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching order: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch order")


@app.websocket("/ws/risk")
async def websocket_risk(websocket: WebSocket) -> None:
    await handle_websocket(websocket, "risk")


@app.get("/api/v1/risk/metrics", response_model=RiskMetricsResponse)
async def get_risk_metrics(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> RiskMetricsResponse:
    try:
        positions = await app.state.db.positions.find(
            {"user_id": current_user["id"]}
        ).to_list(None)

        # Calculate risk metrics
        total_exposure = sum(abs(p["size"] * p["current_price"]) for p in positions)
        margin_used = total_exposure * 0.1  # Example: 10% margin requirement
        margin_ratio = margin_used / total_exposure if total_exposure > 0 else 0
        daily_pnl = sum(p.get("unrealized_pnl", 0) for p in positions)
        total_pnl = daily_pnl  # For simplicity, using same value

        # Create or update risk metrics
        risk_metrics = {
            "user_id": current_user["id"],
            "total_exposure": total_exposure,
            "margin_used": margin_used,
            "margin_ratio": margin_ratio,
            "daily_pnl": daily_pnl,
            "total_pnl": total_pnl,
            "updated_at": datetime.utcnow()
        }

        await app.state.db.risk_metrics.update_one(
            {"user_id": current_user["id"]},
            {"$set": risk_metrics},
            upsert=True
        )

        await broadcast_risk_update(risk_metrics)
        return RiskMetricsResponse(**risk_metrics)
    except Exception as e:
        logger.error(f"Error calculating risk metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to calculate risk metrics")


@app.post("/api/v1/risk/limits", response_model=LimitSettingsResponse)
async def update_limit_settings(
    settings: LimitSettingsUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> LimitSettingsResponse:
    try:
        settings_data = {
            "user_id": current_user["id"],
            "updated_at": datetime.utcnow(),
            **settings.model_dump()
        }
        
        await app.state.db.limit_settings.update_one(
            {"user_id": current_user["id"]},
            {"$set": settings_data},
            upsert=True
        )
        
        await broadcast_limit_update(settings_data)
        return LimitSettingsResponse(**settings_data)
    except Exception as e:
        logger.error(f"Error updating limit settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to update limits")


@app.get("/api/v1/risk/limits", response_model=LimitSettingsResponse)
async def get_limit_settings(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> LimitSettingsResponse:
    try:
        limit_settings = await app.state.db.limit_settings.find_one(
            {"user_id": current_user["id"]}
        )
        if not limit_settings:
            raise HTTPException(status_code=404, detail="Limit settings not found")
        return LimitSettingsResponse(**limit_settings)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching limit settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch limits")


# REST endpoints
@app.get("/api/v1/strategies", response_model=StrategyListResponse)
async def get_strategies() -> StrategyListResponse:
    try:
        strategies = await app.state.db.strategies.find().to_list(None)
        return StrategyListResponse(strategies=strategies)
    except Exception as e:
        logger.error(f"Error fetching strategies: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch strategies")


@app.post("/api/v1/strategies", response_model=StrategyResponse)
async def create_strategy(
    strategy: StrategyCreate,
) -> StrategyResponse:
    try:
        strategy_data = {
            **strategy.model_dump(),
            "created_at": datetime.utcnow(),
            "id": None
        }
        result = await app.state.db.strategies.insert_one(strategy_data)
        strategy_data["id"] = str(result.inserted_id)
        return StrategyResponse(**strategy_data)
    except Exception as e:
        logger.error(f"Error creating strategy: {e}")
        raise HTTPException(status_code=500, detail="Failed to create strategy")


@app.get("/api/v1/agents", response_model=AgentListResponse)
async def list_agents() -> AgentListResponse:
    try:
        agent_types = await app.state.db.agents.distinct("type", {"type": {"$ne": None}})
        return AgentListResponse(agents=agent_types, count=len(agent_types))
    except Exception as e:
        logger.error(f"Error fetching agents: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch agents")


@app.get("/api/v1/agents/{agent_type}/status", response_model=AgentResponse)
async def get_agent_status(
    agent_type: str,
) -> AgentResponse:
    try:
        if not agent_type:
            raise HTTPException(status_code=400, detail="Agent type is required")

        agent = await app.state.db.agents.find_one({"type": agent_type})
        if not agent:
            agent = {
                "type": agent_type,
                "status": AgentStatus.STOPPED,
                "created_at": datetime.utcnow()
            }
            await app.state.db.agents.insert_one(agent)
        return AgentResponse(**agent)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting agent status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get agent status")


@app.patch("/api/v1/agents/{agent_type}/status", response_model=AgentResponse)
async def update_agent_status(
    agent_type: str, status: AgentStatus
) -> AgentResponse:
    try:
        if not agent_type:
            raise HTTPException(status_code=400, detail="Agent type is required")

        agent = await app.state.db.agents.find_one({"type": agent_type})
        if not agent:
            raise HTTPException(status_code=404, detail=f"Agent {agent_type} not found")

        update_data = {
            "status": status,
            "last_updated": datetime.utcnow()
        }
        
        await app.state.db.agents.update_one(
            {"type": agent_type},
            {"$set": update_data}
        )
        
        agent.update(update_data)
        return AgentResponse(**agent)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating agent status: {e}")
        raise HTTPException(status_code=500, detail="Failed to update agent status")


@app.post("/api/v1/agents/{agent_type}/start", response_model=AgentResponse)
async def start_agent(agent_type: str) -> AgentResponse:
    try:
        if not agent_type:
            raise HTTPException(status_code=400, detail="Agent type is required")

        agent = await app.state.db.agents.find_one({"type": agent_type})
        if not agent:
            agent = {
                "type": agent_type,
                "status": AgentStatus.RUNNING,
                "created_at": datetime.utcnow(),
                "last_updated": datetime.utcnow()
            }
            await app.state.db.agents.insert_one(agent)
        elif agent["status"] != AgentStatus.RUNNING:
            await app.state.db.agents.update_one(
                {"type": agent_type},
                {"$set": {
                    "status": AgentStatus.RUNNING,
                    "last_updated": datetime.utcnow()
                }}
            )
            agent["status"] = AgentStatus.RUNNING
            agent["last_updated"] = datetime.utcnow()

        return AgentResponse(**agent)
    except Exception as e:
        logger.error(f"Error starting agent: {e}")
        raise HTTPException(status_code=500, detail="Failed to start agent")


@app.post("/api/v1/agents/{agent_type}/stop", response_model=AgentResponse)
async def stop_agent(agent_type: str) -> AgentResponse:
    try:
        if not agent_type:
            raise HTTPException(status_code=400, detail="Agent type is required")

        agent = await app.state.db.agents.find_one({"type": agent_type})
        if not agent:
            raise HTTPException(status_code=404, detail=f"Agent {agent_type} not found")

        if agent["status"] != AgentStatus.STOPPED:
            await app.state.db.agents.update_one(
                {"type": agent_type},
                {"$set": {
                    "status": AgentStatus.STOPPED,
                    "last_updated": datetime.utcnow()
                }}
            )
            agent["status"] = AgentStatus.STOPPED
            agent["last_updated"] = datetime.utcnow()

        return AgentResponse(**agent)
    except Exception as e:
        logger.error(f"Error stopping agent: {e}")
        raise HTTPException(status_code=500, detail="Failed to stop agent")


@app.post("/api/v1/agents", response_model=AgentResponse)
async def create_agent(
    agent: AgentCreate,
) -> AgentResponse:
    try:
        if not agent.type:
            raise HTTPException(status_code=400, detail="Agent type is required")

        existing_agent = await app.state.db.agents.find_one({"type": agent.type})
        if existing_agent:
            msg = f"Agent with type {agent.type} already exists"
            raise HTTPException(status_code=409, detail=msg)

        agent_data = {
            "type": agent.type,
            "status": agent.status,
            "created_at": datetime.utcnow(),
            "last_updated": datetime.utcnow()
        }
        result = await app.state.db.agents.insert_one(agent_data)
        agent_data["id"] = str(result.inserted_id)
        return AgentResponse(**agent_data)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating agent: {e}")
        raise HTTPException(status_code=500, detail="Failed to create agent")


@app.delete("/api/v1/agents/{agent_type}", response_model=AgentResponse)
async def delete_agent(agent_type: str) -> AgentResponse:
    try:
        if not agent_type:
            raise HTTPException(status_code=400, detail="Agent type is required")

        agent = await app.state.db.agents.find_one({"type": agent_type})
        if not agent:
            raise HTTPException(status_code=404, detail=f"Agent {agent_type} not found")

        # Stop agent if running before deletion
        if agent["status"] == AgentStatus.RUNNING:
            await app.state.db.agents.update_one(
                {"type": agent_type},
                {"$set": {"status": AgentStatus.STOPPED}}
            )
            agent["status"] = AgentStatus.STOPPED

        await app.state.db.agents.delete_one({"type": agent_type})
        return AgentResponse(**agent)
    except Exception as e:
        logger.error(f"Error deleting agent: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete agent")


@app.get("/api/v1/trades", response_model=TradeListResponse)
async def get_trades() -> TradeListResponse:
    try:
        trades = await app.state.db.trades.find().to_list(None)
        return TradeListResponse(trades=trades)
    except Exception as e:
        logger.error(f"Error fetching trades: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch trades")


@app.post("/api/v1/trades", response_model=TradeResponse)
async def create_trade(
    trade: TradeCreate,
) -> TradeResponse:
    try:
        trade_data = {
            **trade.model_dump(),
            "created_at": datetime.utcnow(),
            "id": None
        }
        result = await app.state.db.trades.insert_one(trade_data)
        trade_data["id"] = str(result.inserted_id)

        try:
            await broadcast_trade_update(trade_data)
        except Exception as ws_error:
            logger.error(f"WebSocket broadcast error: {ws_error}")

        return TradeResponse(**trade_data)
    except Exception as e:
        logger.error(f"Error creating trade: {e}")
        raise HTTPException(status_code=500, detail="Failed to create trade")


@app.get("/api/v1/signals", response_model=SignalListResponse)
async def get_signals() -> SignalListResponse:
    try:
        signals = await app.state.db.signals.find().to_list(None)
        return SignalListResponse(signals=signals)
    except Exception as e:
        logger.error(f"Error fetching signals: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch signals")


@app.post("/api/v1/signals", response_model=SignalResponse)
async def create_signal(
    signal: SignalCreate,
) -> SignalResponse:
    try:
        signal_data = {
            **signal.model_dump(),
            "created_at": datetime.utcnow(),
            "id": None
        }
        result = await app.state.db.signals.insert_one(signal_data)
        signal_data["id"] = str(result.inserted_id)

        try:
            await broadcast_signal(signal_data)
        except Exception as ws_error:
            logger.error(f"WebSocket broadcast error: {ws_error}")

        return SignalResponse(**signal_data)
    except Exception as e:
        logger.error(f"Error creating signal: {e}")
        raise HTTPException(status_code=500, detail="Failed to create signal")


@app.get("/api/v1/performance", response_model=PerformanceResponse)
async def get_performance() -> PerformanceResponse:
    try:
        trades = await app.state.db.trades.find().to_list(None)
        total_trades = len(trades)
        if total_trades == 0:
            performance_data = {
                "total_trades": 0,
                "profitable_trades": 0,
                "total_profit": 0.0,
                "win_rate": 0.0,
                "average_profit": 0.0,
                "max_drawdown": 0.0,
            }
            await broadcast_performance_update(performance_data)
            return PerformanceResponse(**performance_data)

        closed_trades = [t for t in trades if t.get("status") == TradeStatus.CLOSED]
        closed_count = len(closed_trades)
        if closed_count == 0:
            performance_data = {
                "total_trades": total_trades,
                "profitable_trades": 0,
                "total_profit": 0.0,
                "win_rate": 0.0,
                "average_profit": 0.0,
                "max_drawdown": 0.0,
            }
            await broadcast_performance_update(performance_data)
            return PerformanceResponse(**performance_data)

        profits = []
        profitable_trades = 0
        total_profit = 0.0

        for trade in closed_trades:
            try:
                profit = calculate_trade_profit(trade)
                if profit == 0.0:
                    logger.warning(f"Could not calculate profit for trade {trade.get('id')}")

                if profit > 0:
                    profitable_trades += 1
                total_profit += profit
                profits.append(profit)
            except (TypeError, AttributeError, Exception) as e:
                logger.error(f"Error calculating profit for trade {trade.get('id')}: {e}")
                continue

        win_rate = profitable_trades / closed_count
        average_profit = total_profit / closed_count

        max_drawdown = 0.0
        peak = 0.0
        for profit in profits:
            peak = max(peak, profit)
            drawdown = peak - profit
            max_drawdown = max(max_drawdown, drawdown)

        performance_data = {
            "total_trades": total_trades,
            "profitable_trades": profitable_trades,
            "total_profit": round(total_profit, 8),
            "win_rate": round(win_rate, 4),
            "average_profit": round(average_profit, 8),
            "max_drawdown": round(max_drawdown, 8),
        }

        await broadcast_performance_update(performance_data)
        return PerformanceResponse(**performance_data)
    except Exception as e:
        logger.error(f"Error calculating performance metrics: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to calculate performance metrics"
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=settings.HOST, port=settings.PORT)
