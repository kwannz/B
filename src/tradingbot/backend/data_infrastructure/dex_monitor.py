import asyncio
import gc
import json
import logging
import os
import time
import zlib
from collections import OrderedDict, defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from functools import lru_cache
from statistics import mean, stdev
from typing import Any, Callable, Dict, List, Optional, Union

import msgpack
import numpy as np
import psutil
import snappy
import websockets
from prometheus_client import Counter, Gauge, Histogram
from websockets.exceptions import WebSocketException


class MonitoringState(Enum):
    """监控状态枚举"""

    INITIALIZING = "initializing"
    RUNNING = "running"
    ERROR = "error"
    STOPPED = "stopped"


class AlertLevel(Enum):
    """告警级别枚举"""

    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class AlertConfig:
    """告警配置"""

    level: AlertLevel
    threshold: float
    cooldown: int  # 告警冷却时间(秒)
    aggregation_window: int  # 聚合窗口(秒)
    description: str


@dataclass
class DexMetrics:
    """DEX监控指标"""

    liquidity_depth: Gauge
    volume_24h: Gauge
    tvl: Gauge
    volatility: Gauge
    price_change: Gauge
    swap_count: Counter
    alert_count: Counter
    update_latency: Histogram
    websocket_errors: Counter
    connection_state: Gauge
    queue_size: Gauge
    message_processing_rate: Counter
    batch_size: Histogram
    memory_usage: Gauge
    dropped_messages: Counter
    cpu_usage: Gauge
    network_latency: Histogram
    network_traffic_in: Counter
    network_traffic_out: Counter
    gc_count: Counter
    gc_duration: Histogram


@dataclass
class CompressionConfig:
    """压缩配置"""

    enabled: bool = True
    algorithm: str = "snappy"  # snappy, zlib, msgpack
    compression_level: int = 6  # zlib压缩级别(1-9)
    min_size: int = 1024  # 最小压缩大小(bytes)
    compress_types: List[str] = None  # 需要压缩的消息类型
    adaptive_threshold: float = 0.7  # 自适应压缩阈值
    multi_level_enabled: bool = True  # 是否启用多级压缩
    max_compression_time: float = 0.01  # 最大压缩时间(秒)
    compression_ratio_threshold: float = 0.5  # 压缩比阈值
    cache_size: int = 1000  # 压缩缓存大小
    parallel_threshold: int = 10000  # 并行压缩阈值(bytes)

    def __post_init__(self):
        if self.compress_types is None:
            self.compress_types = ["market_data", "trade", "liquidity_update"]


class CompressionStrategy:
    """压缩策略"""

    def __init__(self, config: CompressionConfig):
        self.config = config
        self.compression_stats = {
            "algorithm_performance": defaultdict(list),  # 各算法性能统计
            "size_distribution": defaultdict(int),  # 消息大小分布
            "compression_times": defaultdict(list),  # 压缩时间统计
            "compression_ratios": defaultdict(list),  # 压缩比统计
        }
        self.compression_cache = LRUCache(config.cache_size)

    def select_algorithm(self, data_size: int, message_type: str) -> str:
        """选择最优压缩算法"""
        if not self.config.adaptive_threshold:
            return self.config.algorithm

        # 根据历史性能选择算法
        if message_type in self.compression_stats["algorithm_performance"]:
            perf_stats = self.compression_stats["algorithm_performance"][message_type]
            if perf_stats:
                # 计算每个算法的得分
                scores = {}
                for alg in ["snappy", "zlib", "msgpack"]:
                    alg_stats = [s for s in perf_stats if s["algorithm"] == alg]
                    if alg_stats:
                        avg_ratio = mean([s["ratio"] for s in alg_stats])
                        avg_time = mean([s["time"] for s in alg_stats])
                        # 得分 = 压缩比 * 0.7 + 速度 * 0.3
                        scores[alg] = (
                            avg_ratio * 0.7
                            + (1 - avg_time / self.config.max_compression_time) * 0.3
                        )

                if scores:
                    return max(scores.items(), key=lambda x: x[1])[0]

        # 根据数据大小选择默认算法
        if data_size < 1000:
            return "snappy"  # 小数据用snappy
        elif data_size < 10000:
            return "zlib"  # 中等数据用zlib
        else:
            return "msgpack"  # 大数据用msgpack

    def should_compress(self, data_size: int, message_type: str) -> bool:
        """判断是否需要压缩"""
        # 检查大小阈值
        if data_size < self.config.min_size:
            return False

        # 检查消息类型
        if message_type not in self.config.compress_types:
            return False

        # 检查历史压缩效果
        if message_type in self.compression_stats["compression_ratios"]:
            ratios = self.compression_stats["compression_ratios"][message_type]
            if ratios:
                avg_ratio = mean(ratios[-100:])  # 使用最近100次的平均值
                return avg_ratio < self.config.compression_ratio_threshold

        return True

    def update_stats(
        self,
        message_type: str,
        algorithm: str,
        original_size: int,
        compressed_size: int,
        compression_time: float,
    ):
        """更新压缩统计信息"""
        ratio = compressed_size / original_size

        # 更新算法性能统计
        self.compression_stats["algorithm_performance"][message_type].append(
            {
                "algorithm": algorithm,
                "ratio": ratio,
                "time": compression_time,
                "size": original_size,
            }
        )

        # 保持统计数据在合理范围内
        if len(self.compression_stats["algorithm_performance"][message_type]) > 1000:
            self.compression_stats["algorithm_performance"][
                message_type
            ] = self.compression_stats["algorithm_performance"][message_type][-1000:]

        # 更新压缩比统计
        self.compression_stats["compression_ratios"][message_type].append(ratio)
        if len(self.compression_stats["compression_ratios"][message_type]) > 1000:
            self.compression_stats["compression_ratios"][
                message_type
            ] = self.compression_stats["compression_ratios"][message_type][-1000:]

        # 更新大小分布
        size_bucket = self._get_size_bucket(original_size)
        self.compression_stats["size_distribution"][size_bucket] += 1

    def _get_size_bucket(self, size: int) -> str:
        """获取大小分布桶"""
        if size < 1000:
            return "<1KB"
        elif size < 10000:
            return "1KB-10KB"
        elif size < 100000:
            return "10KB-100KB"
        else:
            return ">100KB"


class LRUCache:
    """LRU缓存"""

    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache = OrderedDict()

    def get(self, key: str) -> Optional[bytes]:
        if key not in self.cache:
            return None
        self.cache.move_to_end(key)
        return self.cache[key]

    def put(self, key: str, value: bytes):
        if key in self.cache:
            self.cache.move_to_end(key)
        self.cache[key] = value
        if len(self.cache) > self.capacity:
            self.cache.popitem(last=False)


@dataclass
class PerformanceMetrics:
    """性能指标"""

    compression_ratio: Histogram  # 压缩比
    compression_time: Histogram  # 压缩耗时
    message_size: Histogram  # 消息大小
    processing_time: Histogram  # 处理耗时
    batch_efficiency: Gauge  # 批处理效率
    cache_hit_rate: Gauge  # 缓存命中率
    throughput: Counter  # 消息吞吐量


class DexMonitor:
    """DEX监控系统"""

    def __init__(self, config: Dict):
        self.config = config
        self.logger = logging.getLogger(__name__)

        # 配置参数
        self.update_interval = config.get("update_interval", 1)
        self.volatility_window = config.get("volatility_window", 24)
        self.alert_threshold = config.get("alert_threshold", 0.1)
        self.min_liquidity = config.get("min_liquidity", 1000)
        self.websocket_url = config.get("websocket_url", "ws://localhost:8545")
        self.reconnect_interval = config.get("reconnect_interval", 5)
        self.max_reconnect_attempts = config.get("max_reconnect_attempts", 5)
        self.message_batch_size = config.get("message_batch_size", 100)
        self.message_queue_size = config.get("message_queue_size", 1000)

        # 初始化消息队列
        self.message_queue: asyncio.Queue = asyncio.Queue(
            maxsize=self.message_queue_size
        )
        self.batch_processor: Optional[asyncio.Task] = None

        # 初始化指标
        self.metrics = DexMetrics(
            liquidity_depth=Gauge("dex_liquidity_depth", "DEX liquidity depth"),
            volume_24h=Gauge("dex_volume_24h", "24h trading volume"),
            tvl=Gauge("dex_tvl", "Total value locked"),
            volatility=Gauge("dex_volatility", "Price volatility"),
            price_change=Gauge("dex_price_change", "Price change percentage"),
            swap_count=Counter("dex_swap_count", "Number of swaps"),
            alert_count=Counter("dex_alert_count", "Number of alerts"),
            update_latency=Histogram(
                "dex_update_latency",
                "Metrics update latency",
                buckets=[0.1, 0.5, 1.0, 2.0, 5.0],
            ),
            websocket_errors=Counter(
                "dex_websocket_errors", "WebSocket connection errors"
            ),
            connection_state=Gauge(
                "dex_connection_state", "Connection state", ["type"]
            ),
            queue_size=Gauge("dex_message_queue_size", "Message queue size"),
            message_processing_rate=Counter(
                "dex_message_processing_rate", "Message processing rate"
            ),
            batch_size=Histogram(
                "dex_message_batch_size",
                "Message batch size",
                buckets=[10, 50, 100, 200, 500],
            ),
            memory_usage=Gauge("dex_memory_usage", "Memory usage"),
            dropped_messages=Counter("dex_dropped_messages", "Dropped messages"),
            cpu_usage=Gauge("dex_cpu_usage", "CPU usage percentage"),
            network_latency=Histogram(
                "dex_network_latency",
                "Network latency",
                buckets=[0.001, 0.005, 0.01, 0.05, 0.1],
            ),
            network_traffic_in=Counter(
                "dex_network_traffic_in", "Inbound network traffic in bytes"
            ),
            network_traffic_out=Counter(
                "dex_network_traffic_out", "Outbound network traffic in bytes"
            ),
            gc_count=Counter("dex_gc_count", "Garbage collection count"),
            gc_duration=Histogram(
                "dex_gc_duration",
                "Garbage collection duration",
                buckets=[0.001, 0.01, 0.1, 1.0],
            ),
        )

        # 状态变量
        self.price_history: List[float] = []
        self.alerts: List[Dict] = []
        self.last_price: Optional[float] = None
        self.is_running = False
        self.state = MonitoringState.STOPPED
        self.ws_connection: Optional[Any] = None
        self.update_callbacks: List[Callable] = []
        self.error_callbacks: List[Callable] = []
        self.reconnect_attempts = 0

        # 告警配置
        self.alert_configs = {
            "liquidity": AlertConfig(
                level=AlertLevel.ERROR,
                threshold=self.min_liquidity,
                cooldown=300,  # 5分钟冷却
                aggregation_window=60,  # 1分钟聚合
                description="Low liquidity detected",
            ),
            "volatility": AlertConfig(
                level=AlertLevel.WARNING,
                threshold=self.alert_threshold,
                cooldown=180,  # 3分钟冷却
                aggregation_window=30,  # 30秒聚合
                description="High volatility detected",
            ),
            "price_change": AlertConfig(
                level=AlertLevel.WARNING,
                threshold=self.alert_threshold,
                cooldown=120,  # 2分钟冷却
                aggregation_window=30,  # 30秒聚合
                description="Significant price change detected",
            ),
            "network_latency": AlertConfig(
                level=AlertLevel.ERROR,
                threshold=0.1,  # 100ms
                cooldown=240,  # 4分钟冷却
                aggregation_window=60,  # 1分钟聚合
                description="High network latency detected",
            ),
            "memory_usage": AlertConfig(
                level=AlertLevel.CRITICAL,
                threshold=0.8,  # 80%
                cooldown=600,  # 10分钟冷却
                aggregation_window=300,  # 5分钟聚合
                description="High memory usage detected",
            ),
        }

        # 告警状态
        self.alert_states = defaultdict(
            lambda: {"last_alert": None, "alert_count": 0, "aggregated_values": []}
        )

        # 缓存配置
        self.cache_config = {
            "metrics_ttl": 60,  # 指标缓存60秒
            "pool_data_ttl": 30,  # 池子数据缓存30秒
            "max_cache_size": 1000,  # 最大缓存条目数
        }

        # 压缩配置
        self.compression_config = CompressionConfig(
            enabled=config.get("compression_enabled", True),
            algorithm=config.get("compression_algorithm", "snappy"),
            compression_level=config.get("compression_level", 6),
            min_size=config.get("min_compression_size", 1024),
            compress_types=config.get(
                "compress_types", ["market_data", "trade", "liquidity_update"]
            ),
        )

        # 性能指标
        self.performance_metrics = PerformanceMetrics(
            compression_ratio=Histogram(
                "dex_compression_ratio",
                "Data compression ratio",
                buckets=[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
            ),
            compression_time=Histogram(
                "dex_compression_time",
                "Data compression time",
                buckets=[0.0001, 0.0005, 0.001, 0.005, 0.01],
            ),
            message_size=Histogram(
                "dex_message_size",
                "Message size in bytes",
                buckets=[100, 500, 1000, 5000, 10000],
            ),
            processing_time=Histogram(
                "dex_processing_time",
                "Message processing time",
                buckets=[0.001, 0.005, 0.01, 0.05, 0.1],
            ),
            batch_efficiency=Gauge(
                "dex_batch_efficiency", "Batch processing efficiency"
            ),
            cache_hit_rate=Gauge("dex_cache_hit_rate", "Cache hit rate"),
            throughput=Counter("dex_throughput", "Message throughput"),
        )

        # 性能统计
        self.performance_stats = {
            "cache_hits": 0,
            "cache_misses": 0,
            "total_messages": 0,
            "total_bytes": 0,
            "compressed_bytes": 0,
            "batch_sizes": [],
            "processing_times": [],
        }

        # 压缩策略
        self.compression_strategy = CompressionStrategy(self.compression_config)

    def add_update_callback(self, callback: Callable[[Dict], None]):
        """添加数据更新回调"""
        self.update_callbacks.append(callback)

    def add_error_callback(self, callback: Callable[[str, Exception], None]):
        """添加错误处理回调"""
        self.error_callbacks.append(callback)

    async def start_monitoring(self):
        """启动监控"""
        self.is_running = True
        self.state = MonitoringState.INITIALIZING
        self.logger.info("Starting DEX monitoring...")

        # 启动消息批处理
        self.batch_processor = asyncio.create_task(self._process_message_batch())

        # 启动内存监控
        self.memory_monitor = asyncio.create_task(self._monitor_memory_usage())

        # 启动CPU监控
        self.cpu_monitor = asyncio.create_task(self._monitor_cpu_usage())

        # 启动网络监控
        self.network_monitor = asyncio.create_task(self._monitor_network())

        # 启动GC监控
        self.gc_monitor = asyncio.create_task(self._monitor_gc())

        # 启动WebSocket连接
        asyncio.create_task(self._maintain_websocket_connection())

        while self.is_running:
            try:
                start_time = datetime.now()

                # 更新指标
                await self._update_metrics()
                await self._check_alerts()

                # 更新队列指标
                self.metrics.queue_size.set(self.message_queue.qsize())

                # 记录更新延迟
                update_duration = (datetime.now() - start_time).total_seconds()
                self.metrics.update_latency.observe(update_duration)

                # 更新状态
                if self.state != MonitoringState.ERROR:
                    self.state = MonitoringState.RUNNING
                    self.metrics.connection_state.labels(type="monitoring").set(1)

                # 通知更新回调
                await self._notify_update_callbacks()

                # 等待下一个更新周期
                await asyncio.sleep(self.update_interval)

            except Exception as e:
                self.state = MonitoringState.ERROR
                self.metrics.connection_state.labels(type="monitoring").set(0)
                self.logger.error(f"Error in monitoring loop: {str(e)}")
                await self._notify_error_callbacks("monitoring_error", e)
                await asyncio.sleep(1)

    async def stop_monitoring(self):
        """停止监控"""
        self.is_running = False
        self.state = MonitoringState.STOPPED
        self.metrics.connection_state.labels(type="monitoring").set(0)
        self.metrics.connection_state.labels(type="websocket").set(0)
        self.logger.info("Stopping DEX monitoring...")

        # 取消所有监控任务
        tasks = [
            self.batch_processor,
            self.memory_monitor,
            self.cpu_monitor,
            self.network_monitor,
            self.gc_monitor,
        ]

        for task in tasks:
            if task:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

        # 关闭WebSocket连接
        if self.ws_connection:
            await self.ws_connection.close()

    async def _monitor_memory_usage(self):
        """监控内存使用"""
        process = psutil.Process(os.getpid())

        while self.is_running:
            try:
                # 获取内存使用
                memory_info = process.memory_info()
                self.metrics.memory_usage.set(memory_info.rss)  # 记录RSS内存使用

                # 检查内存使用是否超过阈值 (80% 系统内存)
                system_memory = psutil.virtual_memory()
                if memory_info.rss > system_memory.total * 0.8:
                    self.logger.warning("High memory usage detected")
                    await self._notify_error_callbacks(
                        "high_memory_usage",
                        Exception(
                            f"Memory usage: {memory_info.rss / 1024 / 1024:.2f}MB"
                        ),
                    )

                await asyncio.sleep(60)  # 每分钟检查一次

            except Exception as e:
                self.logger.error(f"Error monitoring memory: {str(e)}")
                await asyncio.sleep(60)

    async def _monitor_cpu_usage(self):
        """监控CPU使用率"""
        process = psutil.Process(os.getpid())

        while self.is_running:
            try:
                # 获取CPU使用率
                cpu_percent = process.cpu_percent(interval=1)
                self.metrics.cpu_usage.set(cpu_percent)

                # 检查CPU使用是否过高
                if cpu_percent > 80:  # CPU使用率超过80%
                    self.logger.warning(f"High CPU usage detected: {cpu_percent}%")
                    await self._notify_error_callbacks(
                        "high_cpu_usage", Exception(f"CPU usage: {cpu_percent}%")
                    )

                    # 触发GC以尝试释放资源
                    gc.collect()

                await asyncio.sleep(5)  # 每5秒检查一次

            except Exception as e:
                self.logger.error(f"Error monitoring CPU: {str(e)}")
                await asyncio.sleep(5)

    async def _monitor_network(self):
        """监控网络性能"""
        process = psutil.Process(os.getpid())
        last_io_counters = process.io_counters()

        while self.is_running:
            try:
                # 测量网络延迟
                start_time = time.time()
                try:
                    socket.create_connection(
                        (self.websocket_url.split("://")[1].split(":")[0], 80),
                        timeout=1,
                    )
                    latency = time.time() - start_time
                    self.metrics.network_latency.observe(latency)
                except Exception:
                    self.logger.warning("Failed to measure network latency")

                # 计算网络流量
                io_counters = process.io_counters()
                bytes_sent = io_counters.write_bytes - last_io_counters.write_bytes
                bytes_recv = io_counters.read_bytes - last_io_counters.read_bytes

                self.metrics.network_traffic_out.inc(bytes_sent)
                self.metrics.network_traffic_in.inc(bytes_recv)

                last_io_counters = io_counters

                # 检查网络延迟是否过高
                if latency > 0.1:  # 延迟超过100ms
                    self.logger.warning(
                        f"High network latency detected: {latency*1000:.2f}ms"
                    )
                    await self._notify_error_callbacks(
                        "high_network_latency",
                        Exception(f"Network latency: {latency*1000:.2f}ms"),
                    )

                await asyncio.sleep(10)  # 每10秒检查一次

            except Exception as e:
                self.logger.error(f"Error monitoring network: {str(e)}")
                await asyncio.sleep(10)

    async def _monitor_gc(self):
        """监控垃圾回收"""
        gc.callbacks.append(self._gc_callback)
        self.gc_start_time = None

        while self.is_running:
            try:
                # 主动触发GC并测量时间
                start_time = time.time()
                gc.collect()
                duration = time.time() - start_time

                self.metrics.gc_count.inc()
                self.metrics.gc_duration.observe(duration)

                # 检查GC时间是否过长
                if duration > 1.0:  # GC时间超过1秒
                    self.logger.warning(f"Long GC duration detected: {duration:.2f}s")
                    await self._notify_error_callbacks(
                        "long_gc_duration", Exception(f"GC duration: {duration:.2f}s")
                    )

                await asyncio.sleep(60)  # 每分钟检查一次

            except Exception as e:
                self.logger.error(f"Error monitoring GC: {str(e)}")
                await asyncio.sleep(60)

    def _gc_callback(self, phase, info):
        """GC回调函数"""
        if phase == "start":
            self.gc_start_time = time.time()
        elif phase == "stop":
            if self.gc_start_time is not None:
                duration = time.time() - self.gc_start_time
                self.metrics.gc_duration.observe(duration)
                self.gc_start_time = None

    async def _process_message_batch(self):
        """批量处理消息"""
        while self.is_running:
            try:
                messages = []
                start_time = datetime.now()

                # 收集消息批次
                while len(messages) < self.message_batch_size:
                    try:
                        message = await asyncio.wait_for(
                            self.message_queue.get(), timeout=0.1  # 100ms超时
                        )
                        messages.append(message)
                    except asyncio.TimeoutError:
                        break

                if not messages:
                    continue

                batch_start_time = time.time()

                # 更新批处理指标
                self.metrics.batch_size.observe(len(messages))
                self.metrics.message_processing_rate.inc(len(messages))
                self.performance_stats["batch_sizes"].append(len(messages))

                # 批量处理消息
                compressed_messages = []
                for message in messages:
                    if (
                        isinstance(message, dict)
                        and message.get("type")
                        in self.compression_config.compress_types
                    ):
                        compressed = await self._compress_data(message)
                        compressed_messages.append(compressed)
                    else:
                        compressed_messages.append(message)

                # 批量处理压缩后的消息
                for message in compressed_messages:
                    if isinstance(message, bytes):
                        message = await self._decompress_data(message)
                    await self._handle_websocket_message(message)

                # 计算处理延迟和效率
                process_time = time.time() - batch_start_time
                self.performance_stats["processing_times"].append(process_time)
                self.performance_metrics.processing_time.observe(process_time)

                # 计算批处理效率
                if len(self.performance_stats["batch_sizes"]) > 100:
                    avg_batch_size = mean(self.performance_stats["batch_sizes"][-100:])
                    avg_process_time = mean(
                        self.performance_stats["processing_times"][-100:]
                    )
                    efficiency = avg_batch_size / (avg_process_time + 0.001)  # 避免除零
                    self.performance_metrics.batch_efficiency.set(efficiency)

                # 更新吞吐量
                self.performance_metrics.throughput.inc(len(messages))
                self.performance_stats["total_messages"] += len(messages)

                # 计算处理延迟
                process_time = (datetime.now() - start_time).total_seconds()
                self.metrics.update_latency.observe(process_time)

            except Exception as e:
                self.logger.error(f"Error processing message batch: {str(e)}")
                await asyncio.sleep(1)

    async def _maintain_websocket_connection(self):
        """维护WebSocket连接"""
        while self.is_running:
            try:
                if not self.ws_connection:
                    self.metrics.connection_state.labels(type="websocket").set(0)
                    await self._connect_websocket()

                # 重置重连计数
                self.reconnect_attempts = 0

            except Exception as e:
                self.metrics.websocket_errors.inc()
                self.metrics.connection_state.labels(type="websocket").set(0)
                self.logger.error(f"WebSocket connection error: {str(e)}")
                await self._notify_error_callbacks("websocket_error", e)

                # 重连逻辑
                self.reconnect_attempts += 1
                if self.reconnect_attempts >= self.max_reconnect_attempts:
                    self.state = MonitoringState.ERROR
                    self.logger.error("Max reconnection attempts reached")
                    break

                await asyncio.sleep(self.reconnect_interval)

    async def _connect_websocket(self):
        """建立WebSocket连接"""
        try:
            # 创建WebSocket连接
            self.ws_connection = await websockets.connect(
                self.websocket_url, ping_interval=20, ping_timeout=10, close_timeout=10
            )

            # 更新连接状态
            self.metrics.connection_state.labels(type="websocket").set(1)
            self.logger.info(f"WebSocket connected to {self.websocket_url}")

            # 启动消息处理循环
            asyncio.create_task(self._process_websocket_messages())

        except Exception as e:
            self.logger.error(f"Failed to connect WebSocket: {str(e)}")
            self.metrics.websocket_errors.inc()
            raise

    async def _process_websocket_messages(self):
        """处理WebSocket消息循环"""
        if not self.ws_connection:
            return

        try:
            async for message in self.ws_connection:
                try:
                    # 解析消息
                    data = json.loads(message)

                    # 添加到消息队列
                    try:
                        await asyncio.wait_for(
                            self.message_queue.put(data), timeout=0.1  # 100ms超时
                        )
                    except asyncio.TimeoutError:
                        self.logger.warning("Message queue full, dropping message")
                        self.metrics.dropped_messages.inc()
                        continue

                except json.JSONDecodeError as e:
                    self.logger.error(f"Invalid message format: {str(e)}")
                    self.metrics.websocket_errors.inc()
                except Exception as e:
                    self.logger.error(f"Error processing message: {str(e)}")
                    self.metrics.websocket_errors.inc()

        except WebSocketException as e:
            self.logger.error(f"WebSocket connection error: {str(e)}")
            self.metrics.websocket_errors.inc()
            self.metrics.connection_state.labels(type="websocket").set(0)

            # 触发重连
            self.ws_connection = None

    async def _handle_websocket_message(self, message: Dict):
        """处理WebSocket消息"""
        try:
            start_time = datetime.now()

            # 验证消息格式
            if not self._validate_message(message):
                self.logger.warning(f"Invalid message format: {message}")
                return

            # 更新相关指标
            if "liquidity" in message:
                self.metrics.liquidity_depth.set(message["liquidity"])
            if "volume" in message:
                self.metrics.volume_24h.set(message["volume"])
            if "tvl" in message:
                self.metrics.tvl.set(message["tvl"])
            if "price" in message:
                current_price = message["price"]
                self.price_history.append(current_price)

                # 计算价格变化
                if self.last_price:
                    price_change = (current_price - self.last_price) / self.last_price
                    self.metrics.price_change.set(price_change)

                    # 检查是否需要触发告警
                    if abs(price_change) > self.alert_threshold:
                        self._add_alert(
                            "price_change",
                            "Significant price change detected",
                            price_change,
                        )

                self.last_price = current_price

            # 计算处理延迟
            process_time = (datetime.now() - start_time).total_seconds()
            self.metrics.update_latency.observe(process_time)

            # 通知更新
            await self._notify_update_callbacks()

        except Exception as e:
            self.logger.error(f"Error processing WebSocket message: {str(e)}")
            await self._notify_error_callbacks("message_processing_error", e)

    def _validate_message(self, message: Dict) -> bool:
        """验证消息格式"""
        required_fields = ["type", "timestamp"]
        if not all(field in message for field in required_fields):
            return False

        # 验证时间戳
        try:
            timestamp = datetime.fromisoformat(message["timestamp"])
            # 检查消息是否过期（超过5分钟）
            if (datetime.now() - timestamp) > timedelta(minutes=5):
                self.logger.warning(f"Message too old: {message['timestamp']}")
                return False
        except ValueError:
            return False

        # 验证消息类型
        valid_types = ["market_data", "trade", "liquidity_update"]
        if message["type"] not in valid_types:
            return False

        return True

    async def _notify_update_callbacks(self):
        """通知更新回调"""
        metrics_summary = self.get_metrics_summary()
        for callback in self.update_callbacks:
            try:
                callback(metrics_summary)
            except Exception as e:
                self.logger.error(f"Error in update callback: {str(e)}")

    async def _notify_error_callbacks(self, error_type: str, error: Exception):
        """通知错误回调"""
        for callback in self.error_callbacks:
            try:
                callback(error_type, error)
            except Exception as e:
                self.logger.error(f"Error in error callback: {str(e)}")

    def get_monitoring_state(self) -> Dict:
        """获取监控状态信息"""
        return {
            "state": self.state.value,
            "websocket_connected": bool(self.ws_connection),
            "reconnect_attempts": self.reconnect_attempts,
            "last_update": datetime.now().isoformat(),
            "error_count": self.metrics.websocket_errors._value.get(),
            "metrics_summary": self.get_metrics_summary(),
        }

    async def _update_metrics(self):
        """更新监控指标"""
        try:
            # 获取池子数据
            pool_data = await self._get_pool_data()

            # 更新基础指标
            self.metrics.liquidity_depth.set(pool_data["liquidity"])
            self.metrics.volume_24h.set(pool_data["volume_24h"])
            self.metrics.tvl.set(pool_data["tvl"])
            self.metrics.swap_count.inc(pool_data["swap_count"])

            # 更新价格相关指标
            current_price = pool_data["price"]
            self.price_history.append(current_price)

            # 保持价格历史在窗口大小内
            if len(self.price_history) > self.volatility_window:
                self.price_history = self.price_history[-self.volatility_window :]

            # 计算波动率
            if len(self.price_history) >= 2:
                returns = np.diff(np.log(self.price_history))
                volatility = np.std(returns) * np.sqrt(24 * 60)  # 年化波动率
                self.metrics.volatility.set(volatility)

            # 计算价格变化
            if self.last_price is not None:
                price_change = (current_price - self.last_price) / self.last_price
                self.metrics.price_change.set(price_change)

            self.last_price = current_price

        except Exception as e:
            self.logger.error(f"Error updating metrics: {str(e)}")
            raise

    @lru_cache(maxsize=1000)
    def _get_cached_metrics(self, metric_name: str) -> Optional[float]:
        """获取缓存的指标值(带性能统计)"""
        try:
            value = self.metrics.__getattribute__(metric_name)._value.get()
            if value is not None:
                self.performance_stats["cache_hits"] += 1
            else:
                self.performance_stats["cache_misses"] += 1

            # 更新缓存命中率
            total_requests = (
                self.performance_stats["cache_hits"]
                + self.performance_stats["cache_misses"]
            )
            if total_requests > 0:
                hit_rate = self.performance_stats["cache_hits"] / total_requests
                self.performance_metrics.cache_hit_rate.set(hit_rate)

            return value
        except:
            self.performance_stats["cache_misses"] += 1
            return None

    async def _check_alerts(self):
        """检查并生成告警"""
        try:
            current_time = datetime.now()

            for alert_type, config in self.alert_configs.items():
                state = self.alert_states[alert_type]
                current_value = self._get_metric_value(alert_type)

                if current_value is None:
                    continue

                # 添加到聚合窗口
                state["aggregated_values"].append(
                    {"value": current_value, "timestamp": current_time}
                )

                # 清理过期的聚合值
                state["aggregated_values"] = [
                    v
                    for v in state["aggregated_values"]
                    if (current_time - v["timestamp"]).total_seconds()
                    <= config.aggregation_window
                ]

                # 检查是否需要触发告警
                if self._should_trigger_alert(alert_type, current_value, state, config):
                    await self._trigger_alert(alert_type, current_value, config)

        except Exception as e:
            self.logger.error(f"Error checking alerts: {str(e)}")

    def _should_trigger_alert(
        self, alert_type: str, current_value: float, state: Dict, config: AlertConfig
    ) -> bool:
        """检查是否应该触发告警"""
        # 检查冷却时间
        if state["last_alert"] is not None:
            cooldown_time = (datetime.now() - state["last_alert"]).total_seconds()
            if cooldown_time < config.cooldown:
                return False

        # 检查聚合窗口内的值
        if len(state["aggregated_values"]) < 3:  # 至少需要3个值才触发告警
            return False

        # 计算聚合窗口内的平均值
        avg_value = np.mean([v["value"] for v in state["aggregated_values"]])

        # 根据告警类型检查阈值
        if alert_type in ["liquidity"]:
            return avg_value < config.threshold
        else:
            return avg_value > config.threshold

    async def _trigger_alert(self, alert_type: str, value: float, config: AlertConfig):
        """触发告警"""
        state = self.alert_states[alert_type]
        state["last_alert"] = datetime.now()
        state["alert_count"] += 1

        alert = {
            "type": alert_type,
            "level": config.level.value,
            "message": config.description,
            "value": value,
            "timestamp": datetime.now().isoformat(),
            "count": state["alert_count"],
        }

        self.alerts.append(alert)
        self.metrics.alert_count.inc()

        # 根据告警级别记录日志
        if config.level in [AlertLevel.ERROR, AlertLevel.CRITICAL]:
            self.logger.error(
                f"Alert [{config.level.value}] {alert_type}: {config.description} "
                f"(value: {value}, count: {state['alert_count']})"
            )
        else:
            self.logger.warning(
                f"Alert [{config.level.value}] {alert_type}: {config.description} "
                f"(value: {value}, count: {state['alert_count']})"
            )

        # 通知错误回调
        if config.level in [AlertLevel.ERROR, AlertLevel.CRITICAL]:
            await self._notify_error_callbacks(
                f"{alert_type}_alert",
                Exception(f"{config.description} (value: {value})"),
            )

    def _get_metric_value(self, metric_type: str) -> Optional[float]:
        """获取指标值"""
        try:
            if metric_type == "liquidity":
                return self._get_cached_metrics("liquidity_depth")
            elif metric_type == "volatility":
                return self._get_cached_metrics("volatility")
            elif metric_type == "price_change":
                return self._get_cached_metrics("price_change")
            elif metric_type == "network_latency":
                return self._get_cached_metrics("network_latency")
            elif metric_type == "memory_usage":
                return psutil.Process(os.getpid()).memory_percent()
        except Exception as e:
            self.logger.error(f"Error getting metric value for {metric_type}: {str(e)}")
            return None

    @lru_cache(maxsize=100)
    async def _get_pool_data(self) -> Dict:
        """获取池子数据(带缓存)"""
        # TODO: 实现实际的链上数据获取
        # 这里使用模拟数据用于测试
        return {
            "liquidity": 1000000,
            "tvl": 5000000,
            "volume_24h": 500000,
            "swap_count": 100,
            "price": 1000.0,
        }

    def get_alerts(
        self, level: Optional[AlertLevel] = None, start_time: Optional[datetime] = None
    ) -> List[Dict]:
        """获取告警列表，支持按级别和时间过滤"""
        filtered_alerts = self.alerts

        if level:
            filtered_alerts = [
                alert for alert in filtered_alerts if alert["level"] == level.value
            ]

        if start_time:
            filtered_alerts = [
                alert
                for alert in filtered_alerts
                if datetime.fromisoformat(alert["timestamp"]) >= start_time
            ]

        return filtered_alerts

    def get_metrics_summary(self) -> Dict:
        """获取指标摘要"""
        return {
            "liquidity_depth": self.metrics.liquidity_depth._value.get(),
            "volume_24h": self.metrics.volume_24h._value.get(),
            "tvl": self.metrics.tvl._value.get(),
            "volatility": self.metrics.volatility._value.get(),
            "price_change": self.metrics.price_change._value.get(),
            "alert_count": self.metrics.alert_count._value.get(),
        }

    async def _compress_data(self, data: Union[Dict, bytes]) -> bytes:
        """压缩数据"""
        try:
            start_time = time.time()

            # 如果是字典，先转换为JSON
            if isinstance(data, dict):
                message_type = data.get("type", "unknown")
                data = json.dumps(data).encode()
            else:
                message_type = "binary"

            original_size = len(data)

            # 检查是否需要压缩
            if not self.compression_strategy.should_compress(
                original_size, message_type
            ):
                return data

            # 检查缓存
            cache_key = f"{message_type}:{hash(data)}"
            cached_data = self.compression_strategy.compression_cache.get(cache_key)
            if cached_data:
                return cached_data

            # 选择压缩算法
            algorithm = self.compression_strategy.select_algorithm(
                original_size, message_type
            )

            # 执行压缩
            if original_size >= self.compression_config.parallel_threshold:
                # 大数据使用并行压缩
                compressed = await self._parallel_compress(data, algorithm)
            else:
                # 小数据使用普通压缩
                compressed = self._compress_with_algorithm(data, algorithm)

            compressed_size = len(compressed)
            compression_time = time.time() - start_time

            # 更新统计信息
            self.compression_strategy.update_stats(
                message_type,
                algorithm,
                original_size,
                compressed_size,
                compression_time,
            )

            # 更新性能指标
            self.performance_metrics.compression_ratio.observe(
                compressed_size / original_size
            )
            self.performance_metrics.compression_time.observe(compression_time)

            # 更新统计信息
            self.performance_stats["total_bytes"] += original_size
            self.performance_stats["compressed_bytes"] += compressed_size

            # 缓存结果
            self.compression_strategy.compression_cache.put(cache_key, compressed)

            return compressed

        except Exception as e:
            self.logger.error(f"Error compressing data: {str(e)}")
            return data

    def _compress_with_algorithm(self, data: bytes, algorithm: str) -> bytes:
        """使用指定算法压缩数据"""
        if algorithm == "snappy":
            return snappy.compress(data)
        elif algorithm == "zlib":
            return zlib.compress(data, self.compression_config.compression_level)
        elif algorithm == "msgpack":
            return msgpack.packb(data)
        else:
            return data

    async def _parallel_compress(self, data: bytes, algorithm: str) -> bytes:
        """并行压缩大数据"""
        chunk_size = 1024 * 1024  # 1MB chunks
        chunks = [data[i : i + chunk_size] for i in range(0, len(data), chunk_size)]

        # 创建压缩任务
        tasks = [
            asyncio.create_task(self._compress_chunk(chunk, algorithm))
            for chunk in chunks
        ]

        # 等待所有任务完成
        compressed_chunks = await asyncio.gather(*tasks)

        # 合并压缩结果
        return b"".join(compressed_chunks)

    async def _compress_chunk(self, chunk: bytes, algorithm: str) -> bytes:
        """压缩数据块"""
        return await asyncio.to_thread(self._compress_with_algorithm, chunk, algorithm)

    def _decompress_data(self, data: bytes) -> Union[Dict, bytes]:
        """解压数据"""
        try:
            # 尝试使用不同的解压算法
            if self.compression_config.algorithm == "snappy":
                return snappy.decompress(data)
            elif self.compression_config.algorithm == "zlib":
                return zlib.decompress(data)
            elif self.compression_config.algorithm == "msgpack":
                return msgpack.unpackb(data)
            else:
                return data

        except Exception as e:
            self.logger.error(f"Error decompressing data: {str(e)}")
            return data

    def get_performance_summary(self) -> Dict:
        """获取性能统计摘要"""
        total_bytes = self.performance_stats["total_bytes"]
        compressed_bytes = self.performance_stats["compressed_bytes"]
        compression_ratio = compressed_bytes / total_bytes if total_bytes > 0 else 1.0

        return {
            "total_messages": self.performance_stats["total_messages"],
            "total_bytes": total_bytes,
            "compressed_bytes": compressed_bytes,
            "compression_ratio": compression_ratio,
            "cache_hit_rate": (
                self.performance_stats["cache_hits"]
                / (
                    self.performance_stats["cache_hits"]
                    + self.performance_stats["cache_misses"]
                )
                if (
                    self.performance_stats["cache_hits"]
                    + self.performance_stats["cache_misses"]
                )
                > 0
                else 0
            ),
            "avg_batch_size": (
                mean(self.performance_stats["batch_sizes"])
                if self.performance_stats["batch_sizes"]
                else 0
            ),
            "avg_processing_time": (
                mean(self.performance_stats["processing_times"])
                if self.performance_stats["processing_times"]
                else 0
            ),
            "throughput": self.performance_metrics.throughput._value.get(),
        }
