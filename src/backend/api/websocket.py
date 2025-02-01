from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set, Optional
import json
import logging
import asyncio
from datetime import datetime

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {
            "trades": set(),
            "positions": set(),
            "metrics": set()
        }
        
    async def connect(self, websocket: WebSocket, channel: str):
        await websocket.accept()
        if channel not in self.active_connections:
            self.active_connections[channel] = set()
        self.active_connections[channel].add(websocket)
        logger.info(f"Client connected to channel {channel}")
        
    def disconnect(self, websocket: WebSocket, channel: str):
        self.active_connections[channel].remove(websocket)
        logger.info(f"Client disconnected from channel {channel}")
        
    async def broadcast(self, message: dict, channel: str):
        disconnected = set()
        for connection in self.active_connections[channel]:
            try:
                await connection.send_json(message)
            except WebSocketDisconnect:
                disconnected.add(connection)
            except Exception as e:
                logger.error(f"Error broadcasting message: {str(e)}")
                disconnected.add(connection)
        
        for connection in disconnected:
            self.disconnect(connection, channel)

manager = ConnectionManager()

async def handle_websocket(websocket: WebSocket, channel: str):
    await manager.connect(websocket, channel)
    try:
        while True:
            try:
                data = await websocket.receive_text()
                # Handle incoming messages if needed
                logger.debug(f"Received message on channel {channel}: {data}")
            except WebSocketDisconnect:
                manager.disconnect(websocket, channel)
                break
            except Exception as e:
                logger.error(f"WebSocket error: {str(e)}")
                break
    finally:
        manager.disconnect(websocket, channel)

async def broadcast_trade_update(trade_data: dict):
    """Broadcast trade updates to connected clients"""
    message = {
        "type": "trade",
        "data": trade_data,
        "timestamp": datetime.utcnow().isoformat()
    }
    await manager.broadcast(message, "trades")

async def broadcast_position_update(position_data: dict):
    """Broadcast position updates to connected clients"""
    message = {
        "type": "position",
        "data": position_data,
        "timestamp": datetime.utcnow().isoformat()
    }
    await manager.broadcast(message, "positions")

async def broadcast_metrics_update(metrics_data: dict):
    """Broadcast metrics updates to connected clients"""
    message = {
        "type": "metrics",
        "data": metrics_data,
        "timestamp": datetime.utcnow().isoformat()
    }
    await manager.broadcast(message, "metrics")

# Example background task for periodic updates
async def periodic_metrics_update():
    """Send periodic metrics updates to connected clients"""
    while True:
        try:
            # This would typically fetch real metrics from your system
            metrics = {
                "active_strategies": 5,
                "total_positions": 10,
                "total_pnl": 15000.0,
                "win_rate": 0.65
            }
            await broadcast_metrics_update(metrics)
        except Exception as e:
            logger.error(f"Error in periodic metrics update: {str(e)}")
        finally:
            await asyncio.sleep(5)  # Update every 5 seconds 