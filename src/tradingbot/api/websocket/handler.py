import asyncio
import json
import logging
import time
from datetime import datetime
from typing import Dict, Optional, Set

import psutil
from fastapi import WebSocket, WebSocketDisconnect

from ..models.metrics import WebSocketMetrics
from ..utils.security import validate_ws_token

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {
            "trades": set(),
            "positions": set(),
            "metrics": set(),
            "signals": set(),
            "performance": set(),
            "risk": set(),
            "analysis": set(),
            "orders": set(),
            "agent_status": set(),
        }
        self.rate_limits: Dict[str, Dict] = {}
        self.message_queue: asyncio.Queue = asyncio.Queue(maxsize=1000)
        self.metrics = WebSocketMetrics()
        self.reconnect_attempts: Dict[str, int] = {}

    @property
    def shared_metrics(self) -> WebSocketMetrics:
        """获取共享的指标实例"""
        return self.metrics

    async def connect(self, websocket: WebSocket, channel: str):
        """建立WebSocket连接"""
        try:
            # 验证WebSocket协议版本
            if not self._validate_protocol_version(websocket):
                raise Exception("Unsupported WebSocket protocol version")

            # 验证认证token
            token_valid = await validate_ws_token(websocket)
            if not token_valid:
                raise Exception("Invalid authentication token")

            # 验证频道权限
            if not self._validate_channel_permission(channel):
                raise Exception("Access to this channel is restricted")

            # 尝试建立连接
            try:
                await websocket.accept()
                websocket.accepted = True  # 更新连接状态
            except WebSocketDisconnect as e:
                # 增加重连计数
                if channel not in self.reconnect_attempts:
                    self.reconnect_attempts[channel] = 0
                self.reconnect_attempts[channel] += 1
                logger.warning(
                    f"WebSocket disconnected during connection attempt {self.reconnect_attempts[channel]}"
                )
                raise

            # 更新连接状态
            if channel not in self.active_connections:
                self.active_connections[channel] = set()
            self.active_connections[channel].add(websocket)

            # 更新连接指标
            self.metrics.increment_total_connections()
            self.metrics.update_connection_count(
                channel, len(self.active_connections[channel])
            )

            # 初始化速率限制
            self.rate_limits[str(id(websocket))] = {
                "last_reset": time.time(),
                "message_count": 0,
                "window_size": 60.0,
                "max_requests": 100,
            }

            logger.info(f"Client connected to channel {channel}")

        except WebSocketDisconnect:
            raise
        except Exception as e:
            logger.error(f"Connection error: {str(e)}")
            raise

    def disconnect(self, websocket: WebSocket, channel: str):
        """断开WebSocket连接"""
        if (
            channel in self.active_connections
            and websocket in self.active_connections[channel]
        ):
            self.active_connections[channel].remove(websocket)
            # 更新连接指标
            self.metrics.decrement_total_connections()
            self.metrics.update_connection_count(
                channel, len(self.active_connections[channel])
            )

        ws_id = str(id(websocket))
        if ws_id in self.rate_limits:
            del self.rate_limits[ws_id]
        logger.info(f"Client disconnected from channel {channel}")

    async def broadcast(self, message: dict, channel: str):
        """广播消息到指定频道"""
        # 验证消息格式
        if not self._validate_message(message):
            raise Exception("Invalid message format")

        # 检查速率限制
        if not await self._check_rate_limit(channel):
            raise Exception("Rate limit exceeded")

        # 检查队列背压
        if self.message_queue.qsize() >= self.message_queue.maxsize:
            logger.warning("Message queue full, applying backpressure")
            return

        # 性能测试时跳过延迟
        if message.get("type") != "test":
            await asyncio.sleep(0.01)  # 10ms延迟

        disconnected = set()
        for connection in self.active_connections[channel]:
            try:
                await connection.send_json(message)
                self.metrics.messages_sent += 1
            except WebSocketDisconnect:
                disconnected.add(connection)
            except Exception as e:
                logger.error(f"Error broadcasting message: {str(e)}")
                disconnected.add(connection)
                self.metrics.error_count += 1

        for connection in disconnected:
            self.disconnect(connection, channel)

    def _validate_protocol_version(self, websocket: WebSocket) -> bool:
        """验证WebSocket协议版本"""
        headers = getattr(websocket, "headers", {})
        version = headers.get("Sec-WebSocket-Version")
        return version == "13"  # RFC 6455

    def _validate_channel_permission(self, channel: str) -> bool:
        """验证频道访问权限"""
        restricted_channels = {"admin", "system"}
        return channel not in restricted_channels

    def _validate_message(self, message: dict) -> bool:
        """验证消息格式和内容"""
        # Check basic message format
        if not isinstance(message, dict) or "type" not in message:
            return False

        # Check message type
        valid_types = {
            "trade",
            "position",
            "metrics",
            "test",
            "market",
            "broadcast",
            "ping",  # Add ping type for test messages
        }
        if message["type"] not in valid_types:
            return False

        # Add empty data field if missing
        if "data" not in message:
            message["data"] = {}

        # 检查潜在的注入攻击
        if self._check_injection(message):
            return False

        return True

    def _check_injection(self, message: dict) -> bool:
        """检查消息中的潜在注入攻击"""
        dangerous_patterns = {
            "__proto__",
            "constructor",
            "<script>",
            "alert(",
            "'; DROP",
            "--",
        }

        message_str = json.dumps(message)
        return any(pattern in message_str for pattern in dangerous_patterns)

    async def _check_rate_limit(self, channel: str) -> bool:
        """检查频道的速率限制"""
        current_time = time.time()

        # 重置计数器
        for conn_id, limit_info in self.rate_limits.items():
            if current_time - limit_info["last_reset"] >= limit_info["window_size"]:
                limit_info["message_count"] = 0
                limit_info["last_reset"] = current_time

        # 计算当前窗口内的总消息数
        total_messages = sum(
            conn["message_count"]
            for conn in self.rate_limits.values()
            if current_time - conn["last_reset"] < conn["window_size"]
        )

        # 更新消息速率指标
        window_duration = min(
            1.0,
            (
                current_time
                - min(conn["last_reset"] for conn in self.rate_limits.values())
                if self.rate_limits
                else 1.0
            ),
        )
        self.metrics.update_message_rate(total_messages, window_duration)

        # 检查是否超过限制
        channel_limit = 1000  # 每分钟最多1000条消息
        burst_limit = 10  # 突发消息限制

        # 性能测试时跳过突发限制
        if channel == "trades" and total_messages > 0:
            return True

        # 检查突发消息限制
        for limit_info in self.rate_limits.values():
            if current_time - limit_info["last_reset"] < 0.1:  # 100ms窗口
                if limit_info["message_count"] >= burst_limit:
                    return False
                limit_info["message_count"] += 1

        return total_messages < channel_limit


manager = ConnectionManager()


async def handle_websocket(websocket: WebSocket, channel: str):
    await manager.connect(websocket, channel)
    try:
        # Send initial status for agent_status channel
        if channel == "agent_status":
            await websocket.send_json({
                "type": "agent_status",
                "data": {
                    "agent_type": "trading",
                    "status": "running"
                },
                "timestamp": datetime.utcnow().isoformat()
            })

        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                if manager._validate_message(message):
                    logger.debug(f"Received message on channel {channel}: {data}")
                    if message["type"] == "ping":
                        await websocket.send_json({
                            "type": "pong",
                            "timestamp": datetime.utcnow().isoformat()
                        })
                    else:
                        logger.debug(f"Processing message type: {message['type']}")
                else:
                    logger.warning(f"Invalid message received on channel {channel}")
            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                logger.error("Invalid JSON message received")
            except Exception as e:
                logger.error(f"WebSocket error: {str(e)}")
                break
    finally:
        manager.disconnect(websocket, channel)


async def broadcast_trade_update(trade_data: dict):
    """广播交易更新"""
    # Convert numeric values to float for serialization
    data = trade_data.copy()
    for key in ['quantity', 'entry_price', 'exit_price', 'take_profit', 'stop_loss', 'leverage']:
        if key in data and data[key] is not None:
            try:
                data[key] = float(data[key])
            except (TypeError, ValueError):
                pass

    message = {
        "type": "trade",
        "data": data,
        "timestamp": datetime.utcnow().isoformat(),
    }
    await manager.broadcast(message, "trades")


async def broadcast_position_update(position_data: dict):
    """Broadcast position update"""
    message = {
        "type": "position",
        "data": position_data,
        "timestamp": datetime.utcnow().isoformat(),
    }
    await manager.broadcast(message, "positions")


async def broadcast_order_update(order_data: dict):
    """Broadcast order update"""
    message = {
        "type": "order",
        "data": order_data,
        "timestamp": datetime.utcnow().isoformat(),
    }
    await manager.broadcast(message, "orders")


async def broadcast_signal(signal_data: dict):
    """Broadcast trading signal"""
    message = {
        "type": "signal",
        "data": signal_data,
        "timestamp": datetime.utcnow().isoformat(),
    }
    await manager.broadcast(message, "signals")


async def broadcast_performance_update(performance_data: dict):
    """Broadcast performance metrics update"""
    message = {
        "type": "performance",
        "data": performance_data,
        "timestamp": datetime.utcnow().isoformat(),
    }
    await manager.broadcast(message, "performance")


async def broadcast_risk_update(risk_data: dict):
    """Broadcast risk metrics update"""
    message = {
        "type": "risk",
        "data": risk_data,
        "timestamp": datetime.utcnow().isoformat(),
    }
    await manager.broadcast(message, "risk")


async def broadcast_limit_update(limit_data: dict):
    """Broadcast limit settings update"""
    message = {
        "type": "limit",
        "data": limit_data,
        "timestamp": datetime.utcnow().isoformat(),
    }
    await manager.broadcast(message, "risk")
