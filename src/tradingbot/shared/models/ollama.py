from typing import Any, Dict, Optional
import httpx
import asyncio
from datetime import datetime
from logging import getLogger

logger = getLogger(__name__)

class OllamaModel:
    def __init__(self, model_name: str = "deepseek-r1:1.5b"):
        self.model_name = model_name
        self.base_url = "http://localhost:11434/api"
        self.timeout = httpx.Timeout(45.0, connect=5.0)
        self.retries = 2
        self.max_tokens = 128  # Limit response length for faster generation

    async def generate(self, prompt: str, **kwargs) -> Dict[str, Any]:
        last_error = None
        for attempt in range(self.retries):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    logger.info(f"Sending request to Ollama API (attempt {attempt + 1}/{self.retries})")
                    response = await client.post(
                        f"{self.base_url}/generate",
                        json={
                            "model": self.model_name,
                            "prompt": prompt,
                            "stream": False,
                            "raw": True,
                            "options": {
                                "num_predict": 64,
                                "temperature": 0.3,
                                "top_k": 20,
                                "top_p": 0.9,
                                "repeat_penalty": 1.2
                            }
                        },
                        headers={"Accept": "application/json"}
                    )
                    response.raise_for_status()
                    result = response.json()
                    
                    if "error" in result:
                        raise Exception(f"Ollama API error: {result['error']}")
                    
                    return {
                        "text": result.get("response", "").strip(),
                        "confidence": 0.8,
                        "model": self.model_name,
                        "latency": result.get("total_duration", 0) / 1e9
                    }
            except httpx.TimeoutException as e:
                last_error = e
                logger.warning(f"Attempt {attempt + 1} timed out")
                if attempt < self.retries - 1:
                    await asyncio.sleep(1)
                continue
            except Exception as e:
                last_error = e
                logger.error(f"Error during attempt {attempt + 1}: {str(e)}")
                if attempt < self.retries - 1:
                    await asyncio.sleep(1)
                continue
        
        raise Exception(f"Failed after {self.retries} attempts. Last error: {str(last_error)}")

    async def analyze_market(self, data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            indicators = data.get('indicators', {})
            macd_data = indicators.get('macd', {})
            bollinger_data = indicators.get('bollinger', {})
            
            # Format numbers safely
            price = float(data.get('price', 0))
            bb_upper = float(bollinger_data.get('upper', 0))
            bb_middle = float(bollinger_data.get('middle', 0))
            bb_lower = float(bollinger_data.get('lower', 0))
            
            prompt = f"""Analyze {data.get('symbol')} price ${price:,.2f} with RSI {indicators.get('rsi', 'N/A')}. Keep response under 50 words."""

            logger.info(f"Generating analysis for {data.get('symbol')}")
            result = await self.generate(prompt)
            
            return {
                "symbol": data.get('symbol'),
                "timestamp": datetime.utcnow().isoformat(),
                "price": data.get('price'),
                "analysis": result["text"],
                "confidence": result["confidence"],
                "indicators": indicators
            }
        except Exception as e:
            logger.error(f"Error analyzing market data: {str(e)}")
            raise
