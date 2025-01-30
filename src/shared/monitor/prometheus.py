from prometheus_client import start_http_server, REGISTRY, Gauge
import logging
from typing import Optional
import psutil
import asyncio
from src.shared.monitor.metrics import collect_metrics_periodically

system_memory = Gauge('system_memory_bytes', 'System memory usage in bytes')
system_cpu = Gauge('system_cpu_percent', 'System CPU usage percentage')

def collect_system_metrics():
    memory = psutil.virtual_memory()
    system_memory.set(memory.used)
    system_cpu.set(psutil.cpu_percent())

def start_prometheus_server(port: int = 8000) -> Optional[int]:
    try:
        start_http_server(port)
        metrics_count = len(list(REGISTRY.collect()))
        collect_system_metrics()  # Initial collection
        
        # Start periodic metric collection in the current event loop
        loop = asyncio.get_running_loop()
        loop.create_task(collect_metrics_periodically())
        
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
