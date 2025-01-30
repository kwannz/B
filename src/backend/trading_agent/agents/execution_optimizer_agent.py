from typing import Dict, Any, Optional
from datetime import datetime
import logging
from .base_agent import BaseAgent
from src.shared.models.deepseek import DeepSeek1_5B
from src.shared.cache.hybrid_cache import HybridCache
from src.shared.monitor.metrics import track_inference_time
from src.shared.utils.batch_processor import BatchProcessor
from src.shared.utils.fallback_manager import FallbackManager

class ExecutionBatchProcessor(BatchProcessor[Dict[str, Any], Dict[str, Any]]):
    def __init__(self, agent):
        super().__init__(max_batch=16, timeout=50)
        self.agent = agent
        
    async def process(self, orders: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
        return await self._process_items(orders)
        
    async def _process_items(self, items: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
        results = []
        for order in items:
            try:
                prompt = f"""优化订单执行：
                订单ID：{order.get('id', '')}
                订单量：{order.get('size', 0)}
                市场深度：{order.get('depth', 0)}
                波动率：{order.get('volatility', 0)}%
                
                输出格式：
                {{
                    "slices": "拆分次数",
                    "intervals": "时间间隔",
                    "price_tolerance": "价格容忍度"
                }}"""
                result = await self.agent.model.generate(prompt)
                results.append(result)
            except Exception as e:
                logging.error(f"Error processing order: {str(e)}")
                results.append({
                    "slices": 1,
                    "intervals": "60s",
                    "price_tolerance": "0.1%"
                })
        return results

class ExecutionOptimizerAgent(BaseAgent):
    def __init__(self, agent_id: str, name: str, config: Dict[str, Any]):
        super().__init__(agent_id, name, config)
        try:
            self.model = DeepSeek1_5B(quantized=True)
        except Exception as e:
            logging.warning(f"Failed to initialize DeepSeek model: {str(e)}")
            from ..tests.mocks import MockDeepSeekModel
            self.model = MockDeepSeekModel()
            
        self.cache = HybridCache()
        self.batch_processor = ExecutionBatchProcessor(self)
        
        class LegacyExecutionSystem:
            async def process(self, orders: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
                return [{
                    "slices": 1,
                    "intervals": "60s",
                    "price_tolerance": "0.1%"
                } for _ in orders]
                
        self.fallback_manager = FallbackManager(self.batch_processor, LegacyExecutionSystem())

    @track_inference_time
    async def optimize_execution(self, order: Dict[str, Any]) -> Dict[str, Any]:
        cache_key = f"execution_plan:{order['id']}"
        if cached := self.cache.get(cache_key):
            return cached
            
        try:
            prompt = f"""优化订单执行：
            订单量：{order.get('size', 0)}
            市场深度：{order.get('depth', 0)}
            波动率：{order.get('volatility', 0)}%
            
            输出格式：
            {{
                "slices": "拆分次数",
                "intervals": "时间间隔",
                "price_tolerance": "价格容忍度"
            }}"""
            result = await self.batch_processor.process([order])
            if result:
                result = result[0]
                self.cache.set(cache_key, result)
                return result
            raise Exception("Failed to generate execution plan")
        except Exception as e:
            logging.error(f"Error optimizing execution: {str(e)}")
            return {
                "slices": 1,
                "intervals": "60s",
                "price_tolerance": "0.1%"
            }

    async def optimize_batch(self, orders: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
        try:
            return await self.batch_processor.process(orders)
        except Exception as e:
            logging.error(f"Error optimizing batch: {str(e)}")
            return [{
                "slices": 1,
                "intervals": "60s",
                "price_tolerance": "0.1%"
            } for _ in orders]

    async def start(self):
        self.status = "active"
        self.last_update = datetime.now().isoformat()

    async def stop(self):
        self.status = "inactive"
        self.last_update = datetime.now().isoformat()

    async def update_config(self, new_config: Dict[str, Any]):
        self.config.update(new_config)
        self.last_update = datetime.now().isoformat()
