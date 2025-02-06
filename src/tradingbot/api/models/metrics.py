from datetime import datetime
from typing import Dict, Optional

from pydantic import BaseModel, Field


class WebSocketMetrics(BaseModel):
    total_connections: int = 0
    active_connections: Dict[str, int] = Field(default_factory=dict)
    messages_sent: int = 0
    messages_received: int = 0
    error_count: int = 0
    message_rate: float = 0.0
    last_update: datetime = Field(default_factory=datetime.utcnow)

    def increment_total_connections(self):
        self.total_connections += 1
        self.last_update = datetime.utcnow()

    def decrement_total_connections(self):
        self.total_connections = max(0, self.total_connections - 1)
        self.last_update = datetime.utcnow()

    def update_connection_count(self, channel: str, count: int):
        self.active_connections[channel] = count
        self.last_update = datetime.utcnow()

    def update_message_rate(self, messages: int, duration: float):
        self.message_rate = messages / max(duration, 0.001)
        self.last_update = datetime.utcnow()
