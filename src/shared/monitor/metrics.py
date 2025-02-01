from prometheus_client import (
    Counter,
    Histogram,
    Gauge,
    Summary,
    CollectorRegistry,
    REGISTRY,
)
import time
import logging
from functools import wraps
from typing import Optional, Callable, Any, Dict
import asyncio
from .memory_metrics import MemoryMetrics
from .prometheus import PrometheusMetrics

memory_metrics = MemoryMetrics()
prometheus_metrics = PrometheusMetrics()

REGISTRY = CollectorRegistry()

inference_latency = Histogram(
    "inference_latency_seconds",
    "Time for AI inference (target <100ms)",
    buckets=[0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1.0],
    registry=REGISTRY,
)

cache_hits = Counter(
    "cache_hits_total", "Number of cache hits (target rate >65%)", registry=REGISTRY
)

cache_misses = Counter(
    "cache_misses_total", "Number of cache misses", registry=REGISTRY
)

agent_errors = Counter(
    "agent_errors_total",
    "Number of agent errors (target rate <0.5%)",
    ["agent", "error_type"],
    registry=REGISTRY,
)

model_fallbacks = Counter(
    "model_fallbacks_total",
    "Number of model fallbacks to legacy system",
    registry=REGISTRY,
)

batch_size = Histogram("batch_size", "Size of batched operations", registry=REGISTRY)

batch_utilization = Histogram(
    "batch_utilization",
    "Batch utilization fraction",
    buckets=[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
    registry=REGISTRY,
)

memory_usage = Gauge(
    "gpu_memory_usage_bytes", "GPU memory usage in bytes", registry=REGISTRY
)

error_rate = Summary("error_rate", "Error rate over time window", registry=REGISTRY)


async def collect_metrics_periodically():
    while True:
        try:
            hit_rate = get_cache_hit_rate()
            err_rate = get_error_rate()
            latency = get_inference_latency()

            if hit_rate < 0.65:
                logging.warning(f"Cache hit rate {hit_rate:.1%} below target 65%")
            if err_rate > 0.005:
                logging.warning(f"Error rate {err_rate:.1%} above target 0.5%")
            if latency > 0.1:
                logging.warning(
                    f"Inference latency {latency*1000:.0f}ms above target 100ms"
                )

            memory_metrics.track_memory_usage()
            memory_metrics.track_gpu_memory()
        except Exception as e:
            logging.error(f"Error collecting metrics: {str(e)}")
        await asyncio.sleep(60)


def track_inference_time(func: Callable) -> Callable:
    @wraps(func)
    async def wrapper(*args, **kwargs):
        start = time.time()
        try:
            result = await func(*args, **kwargs)
            latency = time.time() - start
            inference_latency.observe(latency)
            if latency > 0.1:
                logging.warning(
                    f"Inference latency {latency*1000:.0f}ms above target 100ms"
                )
            return result
        except Exception as e:
            agent_errors.labels(
                agent=args[0].__class__.__name__ if args else "unknown",
                error_type=type(e).__name__,
            ).inc()
            raise

    return wrapper


def track_cache_hit():
    prometheus_metrics.track_cache_hit()


def track_cache_miss():
    prometheus_metrics.track_cache_miss()


def track_model_fallback():
    prometheus_metrics.track_error("model_fallback")


def track_batch_size(size: int):
    prometheus_metrics.track_batch_size("batch_operation", size)


def track_batch_utilization(utilization: float):
    batch_utilization.observe(utilization)
    if utilization < 0.8:
        logging.warning(f"Batch utilization {utilization:.1%} below target 80%")


def track_memory_usage():
    memory_metrics.track_memory_usage()


def track_fallback_rate(success: bool = True):
    model_fallbacks.inc()
    if not success:
        agent_errors.labels(
            agent="fallback_manager", error_type="fallback_failed"
        ).inc()


def get_cache_hit_rate() -> float:
    total = cache_hits._value.get() + cache_misses._value.get()
    hit_rate = (cache_hits._value.get() / total) if total > 0 else 0.0
    if hit_rate < 0.65:
        logging.warning(f"Cache hit rate {hit_rate:.1%} below target 65%")
    return hit_rate


def get_error_rate() -> float:
    try:
        total_ops = inference_latency._count.get()
        if total_ops == 0:
            return 0.0
        total_errors = (
            sum(m._value.get() for m in agent_errors._metrics.values())
            if agent_errors._metrics
            else 0
        )
        rate = total_errors / total_ops
        error_rate.observe(rate)
        if rate > 0.005:
            logging.warning(f"Error rate {rate:.1%} above target 0.5%")
        return rate
    except Exception as e:
        logging.error(f"Error calculating error rate: {str(e)}")
        return 0.0


def get_inference_latency() -> float:
    try:
        count = inference_latency._count.get()
        if count == 0:
            return 0.0
        total = inference_latency._sum.get()
        latency = total / count
        if latency > 0.1:
            logging.warning(
                f"Inference latency {latency*1000:.0f}ms above target 100ms"
            )
        return latency
    except Exception as e:
        logging.error(f"Error calculating inference latency: {str(e)}")
        return 0.0
