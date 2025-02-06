import asyncio
import logging
import uvicorn
import httpx
from typing import Optional
from fastapi import FastAPI
from fastapi.testclient import TestClient

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
            await server.startup()
            self._started.set()
            await server.main_loop()
            await server.shutdown()

        self.server_task = asyncio.create_task(serve())
        await self._started.wait()
        
        # Wait for server to be ready
        retries = 30
        while retries > 0:
            try:
                client = TestClient(self.app)
                response = client.get("/health")
                if response.status_code in (200, 503):
                    return
            except Exception as e:
                logger.error(f"Server startup error: {e}")
            retries -= 1
            await asyncio.sleep(0.1)
        raise RuntimeError("Server failed to start")

    async def stop(self):
        if self.server_task and not self.server_task.done():
            self._should_exit = True
            try:
                # Try graceful shutdown first
                await asyncio.wait_for(self.server_task, timeout=1.0)
            except asyncio.TimeoutError:
                # Force cancel if graceful shutdown fails
                self.server_task.cancel()
                try:
                    await asyncio.shield(self.server_task)
                except (asyncio.CancelledError, Exception) as e:
                    logger.error(f"Error during server shutdown: {e}")
            finally:
                self.server_task = None
                self._should_exit = False
                self._started.clear()
                # Give resources time to clean up
                await asyncio.sleep(0.5)
