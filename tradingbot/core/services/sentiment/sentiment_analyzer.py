import aiohttp
from typing import Dict, Optional
import os

class SentimentAnalyzer:
    def __init__(self):
        self.local_endpoint = os.getenv("LOCAL_MODEL_ENDPOINT", "http://localhost:11434")
        self.remote_endpoint = os.getenv("REMOTE_MODEL_ENDPOINT", "https://api.deepseek.com/v3/completions")
        self.api_key = os.getenv("DEEPSEEK_API_KEY", "")

    async def analyze_text(self, text: str) -> Dict[str, float]:
        try:
            if os.getenv("AI_MODEL_MODE", "LOCAL") != "REMOTE":
                try:
                    result = await self._call_local_model(text)
                    return {"score": result["score"], "model": "local"}
                except Exception as e:
                    if os.getenv("AI_MODEL_MODE") == "LOCAL" and not os.getenv("ALLOW_REMOTE_FALLBACK", "true").lower() == "true":
                        raise e
            
            result = await self._call_remote_model(text)
            return {"score": result["score"], "model": "remote"}
        except Exception as e:
            if os.getenv("ALLOW_FALLBACK", "false").lower() == "true":
                return {"score": 0.5, "model": "fallback"}
            raise e

    async def _call_local_model(self, text: str) -> Dict[str, float]:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.local_endpoint}/api/generate",
                json={"model": "deepseek-sentiment", "prompt": text}
            ) as response:
                result = await response.json()
                return {"score": float(result["score"])}

    async def _call_remote_model(self, text: str) -> Dict[str, float]:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                self.remote_endpoint,
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"model": "deepseek-v3", "prompt": text}
            ) as response:
                result = await response.json()
                return {"score": float(result["score"])}
