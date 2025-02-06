import os
import asyncio
from datetime import datetime
import motor.motor_asyncio
from fastapi import FastAPI, WebSocket, HTTPException
from pymongo import MongoClient

app = FastAPI()

@app.on_event("startup")
async def startup_event():
    try:
        app.state.mongo_client = motor.motor_asyncio.AsyncIOMotorClient(
            os.getenv("MONGODB_URL", "mongodb://localhost:27017"),
            serverSelectionTimeoutMS=5000
        )
        # Test connection
        await app.state.mongo_client.admin.command('ping')
        app.state.db = app.state.mongo_client.tradingbot
        # Initialize collections if they don't exist
        await app.state.db.positions.create_index("symbol")
        await app.state.db.risk_metrics.create_index("timestamp")
    except Exception as e:
        print(f"MongoDB connection error: {e}")
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
            positions = await app.state.db.positions.find().to_list(None)
            position_data = [
                {
                    "symbol": p["symbol"],
                    "size": float(p["size"]),
                    "entry_price": float(p["entry_price"]),
                    "current_price": float(p["current_price"]),
                    "unrealized_pnl": float(p["unrealized_pnl"])
                } for p in positions
            ]

            risk_metrics = await app.state.db.risk_metrics.find_one()
            metrics_data = {
                "total_exposure": float(risk_metrics["total_exposure"]) if risk_metrics else 0,
                "margin_used": float(risk_metrics["margin_used"]) if risk_metrics else 0,
                "daily_pnl": float(risk_metrics["daily_pnl"]) if risk_metrics else 0
            }

            await websocket.send_json({
                "timestamp": datetime.utcnow().isoformat(),
                "metrics": {
                    "active_tokens": len(positions),
                    "positions": position_data,
                    "risk_metrics": metrics_data
                }
            })
            await asyncio.sleep(5)
    except Exception as e:
        print(f"WebSocket error: {e}")
        await websocket.close()
