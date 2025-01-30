from prometheus_client import Counter, Gauge, Histogram, start_http_server, REGISTRY
import logging
from typing import Optional, Dict, Any
import psutil
import asyncio
import time
from contextlib import contextmanager

__all__ = ['PrometheusMetrics', 'start_prometheus_server']

def start_prometheus_server(port: int = 8000) -> Optional[int]:
    """Standalone function to start Prometheus server"""
    try:
        start_http_server(port)
        logging.info(f"Started Prometheus metrics server on port {port}")
        return port
    except OSError as e:
        if "Address already in use" in str(e):
            logging.info("Prometheus server already running")
            return None
        logging.error(f"Failed to start Prometheus server: {str(e)}")
        raise
    except Exception as e:
        logging.error(f"Failed to start Prometheus server: {str(e)}")
        raise

class PrometheusMetrics:
    def __init__(self, namespace="tradingbot", subsystem="agent", registry=None):
        self.namespace = namespace
        self.subsystem = subsystem
        self.registry = registry or REGISTRY
        
        # Counters
        self.error_counter = self.create_counter("errors_total", "Total number of errors")
        self.cache_hits = self.create_counter("cache_hits_total", "Total number of cache hits")
        self.cache_misses = self.create_counter("cache_misses_total", "Total number of cache misses")
        
        # Gauges
        self.memory_gauge = self.create_gauge("memory_usage_bytes", "Memory usage in bytes")
        self.batch_size_gauge = self.create_gauge("batch_size", "Current batch size")
        self.system_memory = self.create_gauge("system_memory_bytes", "System memory usage in bytes")
        self.system_cpu = self.create_gauge("system_cpu_percent", "System CPU usage percentage")
        
        # Histograms
        self.latency_histogram = self.create_histogram(
            "operation_latency_seconds",
            "Operation latency in seconds",
            buckets=[0.1, 0.5, 1.0, 2.0, 5.0]
        )
        self.batch_size_histogram = self.create_histogram(
            "batch_size_total",
            "Batch size distribution",
            buckets=[1, 2, 4, 8, 16, 32]
        )

    def create_counter(self, name: str, description: str) -> Counter:
        return Counter(
            name,
            description,
            namespace=self.namespace,
            subsystem=self.subsystem,
            registry=self.registry
        )

    def create_gauge(self, name: str, description: str) -> Gauge:
        return Gauge(
            name,
            description,
            namespace=self.namespace,
            subsystem=self.subsystem,
            registry=self.registry
        )

    def create_histogram(self, name: str, description: str, buckets=None) -> Histogram:
        return Histogram(
            name,
            description,
            namespace=self.namespace,
            subsystem=self.subsystem,
            buckets=buckets,
            registry=self.registry
        )

    @contextmanager
    def track_latency(self, operation: str):
        start_time = time.time()
        try:
            yield
        finally:
            duration = time.time() - start_time
            histogram = self.create_histogram(
                f"{operation}_latency_seconds",
                f"Latency of {operation} operation in seconds",
                buckets=[0.1, 0.5, 1.0, 2.0, 5.0]
            )
            histogram.observe(duration)

    def track_memory(self):
        memory = psutil.Process().memory_info().rss
        self.memory_gauge.set(memory)

    def track_error(self, error_type: str):
        self.error_counter.inc()

    def track_batch_size(self, operation: str, size: int):
        self.batch_size_histogram.observe(size)
        self.batch_size_gauge.set(size)

    def track_cache_hit(self):
        self.cache_hits.inc()

    def track_cache_miss(self):
        self.cache_misses.inc()

    def get_cache_hit_rate(self) -> float:
        hits = self.cache_hits._value.get()
        misses = self.cache_misses._value.get()
        total = hits + misses
        return hits / total if total > 0 else 0.0

    def collect_system_metrics(self):
        memory = psutil.virtual_memory()
        self.system_memory.set(memory.used)
        self.system_cpu.set(psutil.cpu_percent())

    def start_prometheus_server(self, port: int = 8000) -> Optional[int]:
        try:
            start_http_server(port)
            metrics_count = len(list(REGISTRY.collect()))
            self.collect_system_metrics()
            
            loop = asyncio.get_running_loop()
            loop.create_task(self._collect_metrics_periodically())
            
            logging.info(f"Started Prometheus metrics server on port {port} with {metrics_count} metrics")
            return port
        except OSError as e:
            if "Address already in use" in str(e):
                logging.info("Prometheus server already running")
                return None
            logging.error(f"Failed to start Prometheus server: {str(e)}")
            raise
        except Exception as e:
            logging.error(f"Failed to start Prometheus server: {str(e)}")
            raise

    async def _collect_metrics_periodically(self, interval: int = 15):
        while True:
            self.collect_system_metrics()
            await asyncio.sleep(interval)
