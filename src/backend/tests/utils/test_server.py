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
        self._config = uvicorn.Config(
            app=app,
            host=host,
            port=port,
            log_level="debug",
            reload=False,
            workers=1,
            ws_ping_interval=None,
            ws_ping_timeout=None,
            loop="asyncio"
        )
        self._server = uvicorn.Server(config=self._config)

    async def start(self):
        self._server.install_signal_handlers = lambda: None
        self._server.should_exit = lambda: self._should_exit

        async def run_server():
            self._started.set()
            await asyncio.sleep(0.1)  # Give event loop time to process
            await self._server.serve()

        self.server_task = asyncio.create_task(run_server())
        await self._started.wait()

        # Wait for server to be ready
        retries = 30
        while retries > 0:
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(f"http://{self.host}:{self.port}/health")
                    if response.status_code in (200, 503):
                        return
            except Exception as e:
                logger.debug(f"Server not ready yet: {e}")
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
