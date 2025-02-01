import os
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional

import psutil


@dataclass
class WebSocketMetrics:
    """WebSocket连接指标"""

    messages_sent: int = 0
    error_count: int = 0
    total_connections: int = 0
    active_connections: Dict[str, int] = field(default_factory=dict)
    message_rates: Dict[str, float] = field(default_factory=dict)
    latency_stats: Dict[str, float] = field(default_factory=dict)
    memory_usage: Dict[str, float] = field(default_factory=dict)
    error_rates: Dict[str, float] = field(default_factory=dict)
    message_rate: float = 0.0

    def increment_total_connections(self):
        """增加总连接数"""
        self.total_connections += 1

    def decrement_total_connections(self):
        """减少总连接数"""
        self.total_connections = max(0, self.total_connections - 1)

    def update_connection_count(self, channel: str, count: int):
        """更新频道连接数"""
        self.active_connections[channel] = count

    def update_message_rate(self, messages_count: int, duration: float):
        """更新消息速率"""
        if duration > 0:
            self.message_rate = messages_count / duration

    def update_latency(self, channel: str, latency: float):
        """更新延迟统计"""
        self.latency_stats[channel] = latency

    def update_memory_usage(self, channel: str, usage: float):
        """更新内存使用"""
        self.memory_usage[channel] = usage

    def update_error_rate(self, channel: str, rate: float):
        """更新错误率"""
        self.error_rates[channel] = rate

    def get_summary(self) -> Dict:
        """获取指标摘要"""
        return {
            "total_messages": self.messages_sent,
            "total_errors": self.error_count,
            "active_connections": dict(self.active_connections),
            "message_rates": dict(self.message_rates),
            "latency_stats": dict(self.latency_stats),
            "memory_usage": dict(self.memory_usage),
            "error_rates": dict(self.error_rates),
            "timestamp": datetime.utcnow().isoformat(),
        }


class SystemMetrics:
    """系统性能指标"""

    def __init__(self):
        self.cpu_usage: float = 0.0
        self.memory_usage: Dict[str, float] = {}
        self.disk_usage: Dict[str, float] = {}
        self.network_io: Dict[str, int] = {}
        self.process_stats: Dict[str, Dict] = {}
        self.last_update: datetime = datetime.now()

    def update(self):
        """更新系统指标"""
        # CPU使用率
        self.cpu_usage = psutil.cpu_percent(interval=1)

        # 内存使用
        memory = psutil.virtual_memory()
        self.memory_usage = {
            "total": memory.total / (1024 * 1024 * 1024),  # GB
            "used": memory.used / (1024 * 1024 * 1024),
            "percent": memory.percent,
        }

        # 磁盘使用
        disk = psutil.disk_usage("/")
        self.disk_usage = {
            "total": disk.total / (1024 * 1024 * 1024),
            "used": disk.used / (1024 * 1024 * 1024),
            "percent": disk.percent,
        }

        # 网络IO
        net_io = psutil.net_io_counters()
        self.network_io = {
            "bytes_sent": net_io.bytes_sent,
            "bytes_recv": net_io.bytes_recv,
            "packets_sent": net_io.packets_sent,
            "packets_recv": net_io.packets_recv,
        }

        # 当前进程状态
        process = psutil.Process(os.getpid())
        self.process_stats = {
            "cpu_percent": process.cpu_percent(),
            "memory_percent": process.memory_percent(),
            "threads": process.num_threads(),
            "open_files": len(process.open_files()),
            "connections": len(process.connections()),
        }

        self.last_update = datetime.now()


class TradingMetrics:
    """交易性能指标"""

    def __init__(self):
        self.total_trades: int = 0
        self.successful_trades: int = 0
        self.failed_trades: int = 0
        self.total_volume: float = 0.0
        self.total_commission: float = 0.0
        self.latency_stats: Dict[str, float] = {}
        self.error_stats: Dict[str, int] = {}
        self.pnl_stats: Dict[str, float] = {}
        self.last_update: datetime = datetime.now()

    def update_trade_stats(self, trade_result: Dict):
        """更新交易统计

        Args:
            trade_result: 交易结果信息
        """
        self.total_trades += 1
        if trade_result.get("success", False):
            self.successful_trades += 1
        else:
            self.failed_trades += 1
            error_type = trade_result.get("error_type", "unknown")
            self.error_stats[error_type] = self.error_stats.get(error_type, 0) + 1

        self.total_volume += trade_result.get("volume", 0)
        self.total_commission += trade_result.get("commission", 0)

        # 更新延迟统计
        latency = trade_result.get("latency", 0)
        operation = trade_result.get("operation", "unknown")
        if operation not in self.latency_stats:
            self.latency_stats[operation] = latency
        else:
            # 使用移动平均更新延迟
            alpha = 0.1  # 平滑因子
            self.latency_stats[operation] = (1 - alpha) * self.latency_stats[
                operation
            ] + alpha * latency

        # 更新PnL统计
        if "pnl" in trade_result:
            symbol = trade_result.get("symbol", "unknown")
            self.pnl_stats[symbol] = self.pnl_stats.get(symbol, 0) + trade_result["pnl"]

        self.last_update = datetime.now()

    def get_success_rate(self) -> float:
        """获取交易成功率"""
        return (
            self.successful_trades / self.total_trades if self.total_trades > 0 else 0.0
        )

    def get_average_latency(self) -> float:
        """获取平均延迟"""
        if not self.latency_stats:
            return 0.0
        return sum(self.latency_stats.values()) / len(self.latency_stats)

    def get_error_distribution(self) -> Dict[str, float]:
        """获取错误分布"""
        if not self.error_stats:
            return {}
        total_errors = sum(self.error_stats.values())
        return {
            error_type: count / total_errors
            for error_type, count in self.error_stats.items()
        }
