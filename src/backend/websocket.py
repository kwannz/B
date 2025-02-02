from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set
import json
import asyncio
from datetime import datetime

class ConnectionManager:
    def __init__(self):
        # Store active connections by type (trades, performance, etc.)
        self.active_connections: Dict[str, Set[WebSocket]] = {
            "trades": set(),
            "signals": set(),
            "performance": set(),
            "agent_status": set()
        }

    async def connect(self, websocket: WebSocket, connection_type: str):
        await websocket.accept()
        if connection_type not in self.active_connections:
            self.active_connections[connection_type] = set()
        self.active_connections[connection_type].add(websocket)

    def disconnect(self, websocket: WebSocket, connection_type: str):
        self.active_connections[connection_type].remove(websocket)

    async def broadcast_to_type(self, message: dict, connection_type: str):
        if connection_type not in self.active_connections:
            return
        
        for connection in self.active_connections[connection_type]:
            try:
                await connection.send_json(message)
            except:
                # Remove dead connections
                self.active_connections[connection_type].remove(connection)

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        try:
            await websocket.send_json(message)
        except:
            pass

manager = ConnectionManager()

async def handle_websocket_connection(websocket: WebSocket, connection_type: str):
    await manager.connect(websocket, connection_type)
    try:
        while True:
            # Keep connection alive and handle incoming messages
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                # Handle different message types
                if message.get("type") == "ping":
                    await manager.send_personal_message(
                        {"type": "pong", "timestamp": datetime.utcnow().isoformat()},
                        websocket
                    )
            except json.JSONDecodeError:
                continue
    except WebSocketDisconnect:
        manager.disconnect(websocket, connection_type)

async def broadcast_trade_update(trade_data: dict):
    """Broadcast trade updates to all connected clients"""
    await manager.broadcast_to_type(
        {
            "type": "trade_update",
            "data": trade_data,
            "timestamp": datetime.utcnow().isoformat()
        },
        "trades"
    )

async def broadcast_signal(signal_data: dict):
    """Broadcast new signals to all connected clients"""
    await manager.broadcast_to_type(
        {
            "type": "new_signal",
            "data": signal_data,
            "timestamp": datetime.utcnow().isoformat()
        },
        "signals"
    )

async def broadcast_performance_update(performance_data: dict):
    """Broadcast performance updates to all connected clients"""
    await manager.broadcast_to_type(
        {
            "type": "performance_update",
            "data": performance_data,
            "timestamp": datetime.utcnow().isoformat()
        },
        "performance"
    )

async def broadcast_agent_status(agent_type: str, status: str):
    """Broadcast agent status updates to all connected clients"""
    await manager.broadcast_to_type(
        {
            "type": "agent_status",
            "data": {
                "agent_type": agent_type,
                "status": status
            },
            "timestamp": datetime.utcnow().isoformat()
        },
        "agent_status"
    )
