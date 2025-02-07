from typing import Dict, Any

class BaseExecutor:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
    
    async def start(self) -> bool:
        return True
    
    async def stop(self) -> bool:
        return True
