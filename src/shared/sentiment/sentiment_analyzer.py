from typing import Dict, Any
import aiohttp
import json
from datetime import datetime
from functools import wraps

from tradingbot.shared.config.ai_model import (
    AI_MODEL_MODE, LOCAL_MODEL_ENDPOINT, REMOTE_MODEL_ENDPOINT,
    LOCAL_MODEL_NAME, REMOTE_MODEL_NAME, API_KEY, TEMPERATURE,
    MIN_CONFIDENCE, MAX_RETRIES, RETRY_DELAY
)

from tradingbot.shared.metrics.model_metrics import ModelMetrics

@ModelMetrics.track_request
async def analyze_text(text: str, language: str = "en") -> Dict[str, Any]:
    async with aiohttp.ClientSession() as session:
        if AI_MODEL_MODE == "LOCAL":
            prompt = f"Analyze the sentiment of this text and respond with a JSON object containing a 'score' between 0 and 1 (where 1 is most positive) and a 'label' of either 'positive' or 'negative': {text}"
            data = {
                "model": LOCAL_MODEL_NAME,
                "prompt": prompt,
                "stream": False,
                "temperature": TEMPERATURE
            }
            async with session.post(f"{LOCAL_MODEL_ENDPOINT}/api/generate", json=data) as resp:
                result = await resp.json()
                try:
                    response_text = result.get("response", "")
                    sentiment_data = json.loads(response_text)
                    score = float(sentiment_data.get("score", 0.5))
                    label = sentiment_data.get("label", "positive" if score > 0.5 else "negative")
                except (json.JSONDecodeError, ValueError, AttributeError):
                    score = 0.5
                    label = "neutral"
        else:
            headers = {"Authorization": f"Bearer {API_KEY}"}
            data = {
                "model": REMOTE_MODEL_NAME,
                "prompt": f"Analyze the sentiment of this text: {text}",
                "temperature": TEMPERATURE,
                "max_tokens": 100
            }
            async with session.post(REMOTE_MODEL_ENDPOINT, headers=headers, json=data) as resp:
                result = await resp.json()
                try:
                    score = float(result.get("choices", [{}])[0].get("score", 0.5))
                    label = "positive" if score > 0.5 else "negative"
                except (ValueError, IndexError, AttributeError):
                    score = 0.5
                    label = "neutral"

        return {
            "language": language,
            "score": score,
            "sentiment": label,
            "raw_score": {"label": label, "score": score},
            "timestamp": datetime.utcnow().isoformat()
        }
