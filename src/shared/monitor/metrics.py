from prometheus_client import Counter, Histogram, Gauge, Summary
import time
import logging
from functools import wraps
from typing import Optional, Callable, Any, Dict
import asyncio

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Periodic metric collection
async def collect_metrics_periodically():
    while True:
        try:
            hit_rate = get_cache_hit_rate()
            error_rate = get_error_rate()
            latency = get_inference_latency()
            
            if hit_rate < 0.65:
                logging.warning(f"Cache hit rate {hit_rate:.1%} below target 65%")
            if error_rate > 0.005:
                logging.warning(f"Error rate {error_rate:.1%} above target 0.5%")
            if latency > 0.1:
                logging.warning(f"Inference latency {latency*1000:.0f}ms above target 100ms")
        except Exception as e:
            logging.error(f"Error collecting metrics: {str(e)}")
        await asyncio.sleep(60)  # Collect every minute

# Core metrics with target thresholds from playbook
inference_latency = Histogram('inference_latency_seconds', 'Time for AI inference (target <100ms)',
                            buckets=[.005, .01, .025, .05, .075, .1, .25, .5, .75, 1.0])
cache_hits = Counter('cache_hits_total', 'Number of cache hits (target rate >65%)')
cache_misses = Counter('cache_misses_total', 'Number of cache misses')
agent_errors = Counter('agent_errors_total', 'Number of agent errors (target rate <0.5%)', ['agent', 'error_type'])
model_fallbacks = Counter('model_fallbacks_total', 'Number of model fallbacks to legacy system')
batch_size = Histogram('batch_size', 'Size of batched operations')
memory_usage = Gauge('gpu_memory_usage_bytes', 'GPU memory usage in bytes')
error_rate = Summary('error_rate', 'Error rate over time window')

def track_inference_time(func: Callable) -> Callable:
    @wraps(func)
    async def wrapper(*args, **kwargs):
        start = time.time()
        try:
            result = await func(*args, **kwargs)
            latency = time.time() - start
            inference_latency.observe(latency)
            if latency > 0.1:
                logging.warning(f"Inference latency {latency*1000:.0f}ms above target 100ms")
            return result
        except Exception as e:
            agent_errors.labels(
                agent=args[0].__class__.__name__ if args else "unknown",
                error_type=type(e).__name__
            ).inc()
            raise
    return wrapper

def track_cache_hit():
    cache_hits.inc()

def track_cache_miss():
    cache_misses.inc()

def track_model_fallback():
    model_fallbacks.inc()

def track_batch_size(size: int):
    batch_size.observe(size)

def track_memory_usage(usage_bytes: int):
    memory_usage.set(usage_bytes)

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
        total_errors = sum(m._value.get() for m in agent_errors._metrics.values()) if agent_errors._metrics else 0
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
        
        # Use sum of observations divided by count for accurate average
        total = inference_latency._sum.get()
        latency = total / count
        
        if latency > 0.1:
            logging.warning(f"Inference latency {latency*1000:.0f}ms above target 100ms")
        return latency
    except Exception as e:
        logging.error(f"Error calculating inference latency: {str(e)}")
        return 0.0
