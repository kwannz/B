from prometheus_client import Counter, Histogram, Gauge
import time

# Request counters
local_model_requests = Counter(
    "local_model_requests_total",
    "Total number of local model requests",
    ["model_name", "status"]
)

remote_model_requests = Counter(
    "remote_model_requests_total",
    "Total number of remote model requests",
    ["model_name", "status"]
)

# Latency histograms
model_request_duration = Histogram(
    "model_request_duration_seconds",
    "Model request duration in seconds",
    ["model_name", "mode"],
    buckets=(0.1, 0.5, 1.0, 2.0, 5.0, 10.0)
)

# Memory usage
model_memory_usage = Gauge(
    "model_memory_usage_bytes",
    "Current memory usage of the model",
    ["model_name"]
)

class ModelMetrics:
    @staticmethod
    def track_request(func):
        async def wrapper(*args, **kwargs):
            from tradingbot.shared.config.ai_model import AI_MODEL_MODE, LOCAL_MODEL_NAME, REMOTE_MODEL_NAME
            
            start_time = time.time()
            model_name = LOCAL_MODEL_NAME if AI_MODEL_MODE == "LOCAL" else REMOTE_MODEL_NAME
            
            try:
                result = await func(*args, **kwargs)
                duration = time.time() - start_time
                
                if AI_MODEL_MODE == "LOCAL":
                    local_model_requests.labels(model_name=model_name, status="success").inc()
                    model_request_duration.labels(model_name=model_name, mode="local").observe(duration)
                else:
                    remote_model_requests.labels(model_name=model_name, status="success").inc()
                    model_request_duration.labels(model_name=model_name, mode="remote").observe(duration)
                
                return result
            except Exception as e:
                if AI_MODEL_MODE == "LOCAL":
                    local_model_requests.labels(model_name=model_name, status="error").inc()
                else:
                    remote_model_requests.labels(model_name=model_name, status="error").inc()
                raise e
            
        return wrapper
