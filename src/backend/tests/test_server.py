import asyncio
import logging
import uvicorn
from typing import Optional
from fastapi import FastAPI

logger = logging.getLogger(__name__)

class TestServer:
    def __init__(self, app: FastAPI, host: str = "127.0.0.1", port: int = 8123):
        self.app = app
        self.host = host
        self.port = port
        self.server_task: Optional[asyncio.Task] = None
        self._started = asyncio.Event()
        self._should_exit = False

    async def start(self):
        config = uvicorn.Config(
            self.app,
            host=self.host,
            port=self.port,
            log_level="debug",
            reload=False,
            workers=1,
            ws_ping_interval=None,
            ws_ping_timeout=None,
            loop="asyncio"
        )
        server = uvicorn.Server(config)
        server.install_signal_handlers = lambda: None
        server.should_exit = lambda: self._should_exit

        async def serve():
            self._started.set()
            await server.serve()

        self.server_task = asyncio.create_task(serve())
        await self._started.wait()
        await asyncio.sleep(0.1)  # Give server a moment to fully initialize

    async def stop(self):
        if self.server_task:
            self._should_exit = True
            try:
                await asyncio.wait_for(self.server_task, timeout=5.0)
            except asyncio.TimeoutError:
                self.server_task.cancel()
                try:
                    await self.server_task
                except asyncio.CancelledError:
                    pass
            self.server_task = None
            self._should_exit = False
            self._started.clear()
            await asyncio.sleep(0.1)  # Give server a moment to fully shutdown
