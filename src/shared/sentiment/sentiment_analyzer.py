from typing import Dict, Any
import aiohttp
import json
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

@ModelMetrics.track_request
async def analyze_text(text: str, language: str = "en") -> Dict[str, Any]:
    async with aiohttp.ClientSession() as session:
        if AI_MODEL_MODE == "REMOTE":
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

        # Try local model if not in REMOTE mode
        prompt = f"Analyze the sentiment of this text and respond with a JSON object containing a 'score' between 0 and 1 (where 1 is most positive) and a 'label' of either 'positive' or 'negative': {text}"
        data = {
            "model": LOCAL_MODEL_NAME,
            "prompt": prompt,
            "stream": False,
            "temperature": TEMPERATURE
        }
        try:
            async with session.post(f"{LOCAL_MODEL_ENDPOINT}/api/generate", json=data) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    response_text = result.get("response", "")
                    try:
                        # Try to parse the response as JSON first
                        response_text = result.get("response", "")
                        try:
                            sentiment_data = json.loads(response_text)
                            score = float(sentiment_data.get("score", 0.5))
                            label = sentiment_data.get("label", "positive" if score > 0.5 else "negative")
                        except (json.JSONDecodeError, ValueError, KeyError):
                            # Fallback to text analysis if JSON parsing fails
                            if "positive" in response_text.lower():
                                score = 0.9
                                label = "positive"
                            elif "negative" in response_text.lower():
                                score = 0.2
                                label = "negative"
                            else:
                                score = 0.5
                                label = "neutral"
                        
                        return {
                            "language": language,
                            "score": score,
                            "sentiment": label,
                            "raw_score": {"label": label, "score": score},
                            "timestamp": datetime.utcnow().isoformat(),
                            "model": "local"
                        }
                    except Exception as parse_error:
                        raise parse_error
        except Exception as e:
            # In REMOTE mode, try remote endpoint and raise any errors
            if AI_MODEL_MODE == "REMOTE":
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
        
        # Default fallback response
        score = 0.5
        label = "neutral"

        return {
            "language": language,
            "score": score,
            "sentiment": label,
            "raw_score": {"label": label, "score": score},
            "timestamp": datetime.utcnow().isoformat(),
            "model": "fallback"
        }
