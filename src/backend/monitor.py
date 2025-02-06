import os
import asyncio
import logging
from datetime import datetime
import motor.motor_asyncio
from fastapi import FastAPI, WebSocket, HTTPException, BackgroundTasks
from pymongo import MongoClient
from tradingbot.shared.exchange.jupiter_client import JupiterClient

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

app = FastAPI()

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

async def monitor_jupiter_metrics():
    while True:
        try:
            jupiter_metrics = {
                "circuit_breaker_failures": app.state.jupiter_client.circuit_breaker_failures,
                "last_failure_time": app.state.jupiter_client.last_failure_time,
                "current_delay": app.state.jupiter_client.retry_delay,
                "timestamp": datetime.utcnow(),
                "trades": await app.state.db.trades.find().sort("timestamp", -1).limit(10).to_list(None),
                "wallet_balance": await app.state.db.wallet.find_one({"type": "balance"}),
                "risk_metrics": await app.state.db.risk_metrics.find_one()
            }
            await app.state.db.metrics.update_one(
                {"type": "jupiter_metrics"},
                {"$set": jupiter_metrics},
                upsert=True
            )
            await asyncio.sleep(60)
        except Exception as e:
            logger.error(f"Error monitoring Jupiter metrics: {e}")
            await asyncio.sleep(30)

@app.on_event("startup")
async def startup_event():
    try:
        logger.info("Initializing MongoDB connection...")
        app.state.mongo_client = motor.motor_asyncio.AsyncIOMotorClient(
            os.getenv("MONGODB_URL", "mongodb://localhost:27017"),
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            socketTimeoutMS=5000
        )
        logger.info("Testing MongoDB connection...")
        await app.state.mongo_client.admin.command('ping')
        app.state.db = app.state.mongo_client.tradingbot
        logger.info("Initializing collections and indexes...")
        await app.state.db.positions.create_index("symbol")
        await app.state.db.risk_metrics.create_index("timestamp")
        await app.state.db.metrics.create_index([("type", 1), ("timestamp", -1)])
        
        # Initialize Jupiter client for monitoring
        app.state.jupiter_client = JupiterClient({
            "slippage_bps": 200,
            "retry_count": 3,
            "retry_delay": 1000
        })
        await app.state.jupiter_client.start()
        
        # Start monitoring tasks
        background_tasks = BackgroundTasks()
        background_tasks.add_task(monitor_jupiter_metrics)
        
        logger.info("MongoDB and monitoring initialization complete")
    except Exception as e:
        logger.error(f"Initialization error: {e}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    if hasattr(app.state, 'jupiter_client'):
        await app.state.jupiter_client.stop()
    if hasattr(app.state, 'mongo_client'):
        app.state.mongo_client.close()

@app.get("/api/v1/health")
async def health_check():
    try:
        await app.state.db.command("ping")
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "database": "connected"
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")

@app.get("/api/v1/jupiter-metrics")
async def get_jupiter_metrics():
    try:
        metrics = await app.state.db.metrics.find_one({"type": "jupiter_metrics"})
        if not metrics:
            return {"error": "No Jupiter metrics available"}
        return {
            "timestamp": metrics["timestamp"].isoformat(),
            "circuit_breaker_failures": metrics["circuit_breaker_failures"],
            "last_failure_time": metrics["last_failure_time"],
            "current_delay": metrics["current_delay"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            try:
                positions = await app.state.db.positions.find().to_list(None)
                position_data = [
                    {
                        "symbol": p["symbol"],
                        "size": float(p.get("size", 0)),
                        "entry_price": float(p.get("entry_price", 0)),
                        "current_price": float(p.get("current_price", 0)),
                        "unrealized_pnl": float(p.get("unrealized_pnl", 0))
                    } for p in positions
                ] if positions else []

                risk_metrics = await app.state.db.risk_metrics.find_one()
                metrics_data = {
                    "total_exposure": float(risk_metrics.get("total_exposure", 0)) if risk_metrics else 0,
                    "margin_used": float(risk_metrics.get("margin_used", 0)) if risk_metrics else 0,
                    "daily_pnl": float(risk_metrics.get("daily_pnl", 0)) if risk_metrics else 0
                }

                jupiter_metrics = await app.state.db.metrics.find_one({"type": "jupiter_metrics"})
                jupiter_data = {
                    "circuit_breaker_failures": jupiter_metrics.get("circuit_breaker_failures", 0),
                    "last_failure_time": jupiter_metrics.get("last_failure_time", 0),
                    "current_delay": jupiter_metrics.get("current_delay", 1000)
                } if jupiter_metrics else {}

                await websocket.send_json({
                    "timestamp": datetime.utcnow().isoformat(),
                    "metrics": {
                        "active_tokens": len(positions),
                        "positions": position_data,
                        "risk_metrics": metrics_data,
                        "jupiter_metrics": jupiter_data
                    }
                })
            except Exception as e:
                logger.error(f"Error collecting metrics: {e}")
                metrics_data = {"error": str(e)}
                await websocket.send_json({
                    "timestamp": datetime.utcnow().isoformat(),
                    "metrics": metrics_data
                })
            await asyncio.sleep(5)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        await websocket.close()
