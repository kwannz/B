import asyncio
from typing import List, Any, Dict, TypeVar, Generic, Union, Optional
from datetime import datetime
import time
import logging

T = TypeVar('T')
R = TypeVar('R')

class BatchProcessor(Generic[T, R]):
    def __init__(self, max_batch: int = 16, timeout: int = 50):
        self.batch: List[T] = []
        self.max_batch = max_batch
        self.timeout = timeout
        self.processing = False
        self._lock = asyncio.Lock()
        self.results: Dict[int, List[R]] = {}
        self._current_batch_id = 0
        
    async def _process_items(self, items: List[T]) -> List[R]:
        raise NotImplementedError("Subclasses must implement _process_items")
        
    async def process(self, request: Union[T, List[T]]) -> Union[Optional[R], List[R]]:
        from src.shared.monitor.metrics import track_batch_size
        async with self._lock:
            if isinstance(request, list):
                track_batch_size(len(request))
            if isinstance(request, list):
                if not request:
                    return []
                batch_id = self._current_batch_id
                self._current_batch_id += 1
                try:
                    results = await self._process_items(request)
                    self.results[batch_id] = results
                    return results
                except Exception as e:
                    logging.error(f"Error processing batch {batch_id}: {str(e)}")
                    return []
                    
            self.batch.append(request)
            if len(self.batch) >= self.max_batch:
                results = await self._flush()
                if results and len(results) > 0:
                    return results[0]
                return None
            
            if not self.processing:
                self.processing = True
                asyncio.create_task(self._delayed_flush())
                
            return await self._wait_for_result(request)
                
    async def _delayed_flush(self):
        await asyncio.sleep(self.timeout / 1000)
        async with self._lock:
            if self.batch:
                await self._flush()
            self.processing = False
            
    async def _flush(self) -> List[R]:
        if not self.batch:
            return []
            
        try:
            batch = self.batch.copy()
            batch_id = self._current_batch_id
            self._current_batch_id += 1
            results = await self._process_items(batch)
            self.results[batch_id] = results
            return results
        except Exception as e:
            logging.error(f"Error in batch flush: {str(e)}")
            return []
        finally:
            self.batch.clear()
            
    async def _wait_for_result(self, request: T) -> Optional[R]:
        start_time = time.time()
        while request in self.batch:
            if time.time() - start_time > self.timeout / 1000:
                return None
            await asyncio.sleep(0.01)
            
        for results in self.results.values():
            for result in results:
                if id(result) == id(request):
                    return result
        return None
