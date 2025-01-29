from typing import Dict, Any
import aiohttp
import json
import os
from datetime import datetime
from functools import wraps

from src.shared.config.ai_model import (
    AI_MODEL_MODE, LOCAL_MODEL_ENDPOINT, REMOTE_MODEL_ENDPOINT,
    LOCAL_MODEL_NAME, REMOTE_MODEL_NAME, API_KEY, TEMPERATURE,
    MIN_CONFIDENCE, MAX_RETRIES, RETRY_DELAY
)

try:
    from tradingbot.shared.metrics.model_metrics import ModelMetrics
except ImportError:
    # Mock metrics for testing
    class ModelMetrics:
        @staticmethod
        def track_request(func):
            async def wrapper(*args, **kwargs):
                return await func(*args, **kwargs)
            return wrapper

async def call_local_model(session: aiohttp.ClientSession, text: str, language: str) -> Dict[str, Any]:
    prompt = f"Analyze the sentiment of this text and respond with a JSON object containing a 'score' between 0 and 1 (where 1 is most positive) and a 'label' of either 'positive' or 'negative': {text}"
    data = {
        "model": LOCAL_MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "temperature": TEMPERATURE
    }
    async with session.post(f"{LOCAL_MODEL_ENDPOINT}/api/generate", json=data) as resp:
        if resp.status == 200:
            result = await resp.json()
            response_text = result.get("response", "")
            sentiment_data = json.loads(response_text)
            score = float(sentiment_data.get("score", 0.5))
            label = sentiment_data.get("label", "positive" if score > 0.5 else "negative")
            return {
                "language": language,
                "score": score,
                "sentiment": label,
                "raw_score": {"label": label, "score": score},
                "timestamp": datetime.utcnow().isoformat(),
                "model": "local"
            }
    raise Exception("Local model failed to return valid response")

async def call_remote_model(session: aiohttp.ClientSession, text: str, language: str) -> Dict[str, Any]:
    headers = {"Authorization": f"Bearer {API_KEY}"}
    data = {
        "model": REMOTE_MODEL_NAME,
        "prompt": f"Analyze the sentiment of this text: {text}",
        "temperature": TEMPERATURE,
        "max_tokens": 100
    }
    async with session.post(REMOTE_MODEL_ENDPOINT, headers=headers, json=data) as resp:
        if resp.status == 200:
            result = await resp.json()
            choices = result.get("choices", [{}])
            if choices and "score" in choices[0]:
                score = float(choices[0]["score"])
                label = "positive" if score > 0.5 else "negative"
                return {
                    "language": language,
                    "score": score,
                    "sentiment": label,
                    "raw_score": {"label": label, "score": score},
                    "timestamp": datetime.utcnow().isoformat(),
                    "model": "remote"
                }
    raise Exception("Remote model failed to return valid response")

@ModelMetrics.track_request
async def analyze_text(text: str, language: str = "en") -> Dict[str, Any]:
    print(f"Starting sentiment analysis with mode: {AI_MODEL_MODE}")
    async with aiohttp.ClientSession() as session:
        try:
            # Always try local model first unless explicitly set to REMOTE
            if AI_MODEL_MODE != "REMOTE":
                try:
                    print("Attempting local model analysis...")
                    result = await call_local_model(session, text, language)
                    print(f"Local model succeeded: {result}")
                    return result
                except Exception as e:
                    print(f"Local model failed: {str(e)}")
                    if AI_MODEL_MODE == "LOCAL" and not os.getenv("ALLOW_REMOTE_FALLBACK", "true").lower() == "true":
                        raise e

            # Try remote model if local failed or in REMOTE mode
            print("Attempting remote model analysis...")
            result = await call_remote_model(session, text, language)
            print(f"Remote model succeeded: {result}")
            return result
        except Exception as e:
            print(f"Model calls failed: {str(e)}")
            if AI_MODEL_MODE in ["LOCAL", "REMOTE"]:
                raise e

        print("Both models failed, using fallback")
        return {
            "language": language,
            "score": 0.5,
            "sentiment": "neutral",
            "raw_score": {"label": "neutral", "score": 0.5},
            "timestamp": datetime.utcnow().isoformat(),
            "model": "fallback"
        }
