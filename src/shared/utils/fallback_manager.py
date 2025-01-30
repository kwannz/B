import logging
from typing import TypeVar, Generic, Any, Optional
from src.shared.monitor.metrics import track_model_fallback

T = TypeVar('T')
R = TypeVar('R')

class FallbackManager(Generic[T, R]):
    def __init__(self, new_system: Any, legacy_system: Any):
        self.new = new_system
        self.old = legacy_system
        
    async def execute(self, request: T) -> Optional[R]:

        try:
            if hasattr(self.new, 'process'):
                return await self.new.process(request)
            elif hasattr(self.new, 'generate'):
                return await self.new.generate(request)
            raise AttributeError("Primary system has no process/generate method")
        except Exception as e:
            logging.warning(f"Switching to legacy system: {str(e)}")
            track_model_fallback()
            try:
                if hasattr(self.old, 'process'):
                    return await self.old.process(request)
                elif hasattr(self.old, 'generate'):
                    return await self.old.generate(request)
                raise AttributeError("Legacy system has no process/generate method")
            except Exception as e:
                logging.error(f"Both systems failed: {str(e)}")
                return None
                
    async def execute_batch(self, requests: list[T]) -> list[Optional[R]]:
        try:
            if hasattr(self.new, 'generate_batch'):
                return await self.new.generate_batch(requests)
            elif hasattr(self.new, 'process'):
                return await self.new.process(requests)
            
            results = []
            for request in requests:
                try:
                    result = await self.execute(request)
                    results.append(result)
                except Exception as e:
                    logging.warning(f"Batch item failed: {str(e)}")
                    results.append(None)
            return results
        except Exception as e:
            logging.warning(f"Switching to legacy system for batch: {str(e)}")
            track_model_fallback()
            try:
                if hasattr(self.old, 'process'):
                    return await self.old.process(requests)
                results = []
                for request in requests:
                    try:
                        result = await self.old.generate(request)
                        results.append(result)
                    except Exception:
                        results.append(None)
                return results
            except Exception as e:
                logging.error(f"Both systems failed for batch: {str(e)}")
                return [None] * len(requests)
