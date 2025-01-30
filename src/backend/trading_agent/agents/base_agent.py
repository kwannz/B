from abc import ABC, abstractmethod
import logging
from typing import Dict, Any
from shared.cache.hybrid_cache import HybridCache
from src.shared.monitor.prometheus import start_prometheus_server
from src.shared.monitor.metrics import (
    track_inference_time, track_cache_hit, track_cache_miss,
    get_cache_hit_rate, get_error_rate, get_inference_latency
)

class BaseAgent(ABC):
    def __init__(self, agent_id: str, name: str, config: Dict[str, Any]):
        self.agent_id = agent_id
        self.name = name
        self.config = config
        self.status = "inactive"
        self.last_update = None
        self.cache = HybridCache()

    @abstractmethod
    async def start(self):
        """Start the agent's operations"""
        if not hasattr(BaseAgent, '_prometheus_started'):
            start_prometheus_server()
            BaseAgent._prometheus_started = True
            logging.info(f"Agent {self.name} ({self.agent_id}) started with monitoring enabled")
            
    @track_inference_time
    async def _process_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Base method for processing requests with monitoring"""
        try:
            cached = self.cache.get(request.get('cache_key'))
            if cached:
                track_cache_hit()
                return cached
            track_cache_miss()
            return {}
        except Exception as e:
            logging.error(f"Error processing request in {self.name}: {str(e)}")
            raise

    @abstractmethod
    async def stop(self):
        """Stop the agent's operations"""
        pass

    @abstractmethod
    async def update_config(self, new_config: Dict[str, Any]):
        """Update agent configuration"""
        pass

    def get_status(self) -> Dict[str, Any]:
        """Get agent's current status including monitoring metrics"""
        status = {
            "id": self.agent_id,
            "name": self.name,
            "status": self.status,
            "last_update": self.last_update,
            "config": self.config,
            "metrics": {
                "cache_hit_rate": get_cache_hit_rate(),
                "error_rate": get_error_rate(),
                "inference_latency": get_inference_latency(),
            }
        }
        
        # Add warnings for metrics outside target ranges
        warnings = []
        if status["metrics"]["cache_hit_rate"] < 0.65:
            warnings.append("Cache hit rate below target 65%")
        if status["metrics"]["error_rate"] > 0.005:
            warnings.append("Error rate above target 0.5%")
        if status["metrics"]["inference_latency"] > 0.1:
            warnings.append("Inference latency above target 100ms")
            
        if warnings:
            status["warnings"] = warnings
            
        return status
