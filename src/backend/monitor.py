import os
import asyncio
import logging
from datetime import datetime
import motor.motor_asyncio
from fastapi import FastAPI, WebSocket, HTTPException
from pymongo import MongoClient

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

app = FastAPI()

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

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
        logger.info("MongoDB initialization complete")
    except Exception as e:
        logger.error(f"MongoDB connection error: {e}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
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

                await websocket.send_json({
                    "timestamp": datetime.utcnow().isoformat(),
                    "metrics": {
                        "active_tokens": len(positions),
                        "positions": position_data,
                        "risk_metrics": metrics_data
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
