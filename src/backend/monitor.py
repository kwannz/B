from fastapi import FastAPI, WebSocket
import asyncio
from tradingbot.api.monitoring.service import monitoring_service

app = FastAPI()

@app.on_event("startup")
async def startup_event():
    await monitoring_service.start()

@app.on_event("shutdown")
async def shutdown_event():
    await monitoring_service.stop()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            metrics = await monitoring_service.get_monitoring_data()
            await websocket.send_json({
                "timestamp": metrics.timestamp,
                "metrics": {
                    "active_tokens": metrics.active_tokens,
                    "trading_volume": metrics.trading_volume,
                    "positions": [p.dict() for p in metrics.positions],
                    "risk_metrics": metrics.risk_metrics.dict()
                }
            })
            await asyncio.sleep(5)
    except Exception:
        await websocket.close()
