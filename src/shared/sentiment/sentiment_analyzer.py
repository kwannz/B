from typing import Dict, Any, Optional
import aiohttp
import json
import os
from datetime import datetime
from functools import wraps

<<<<<<< HEAD
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_API_URL = os.getenv("DEEPSEEK_API_URL", "https://api.deepseek.com")

async def analyze_text(text: str, language: str = "en", retry_count: int = 3) -> Dict[str, Any]:
    """Analyze sentiment of text using DeepSeek API."""
    if not DEEPSEEK_API_KEY:
        raise ValueError("DEEPSEEK_API_KEY environment variable not set")
        
    if not text:
        raise ValueError("Text cannot be empty")
    
    if language not in ["en", "zh"]:
        raise ValueError(f"Unsupported language: {language}")
        
    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json"
||||||| 8d442a778
async def analyze_text(text: str, language: str = "en") -> Dict[str, Any]:
    """Analyze sentiment of text using DeepSeek API."""
    # Mock implementation for testing
    # Use 0.9 score for Chinese text
    score = 0.9 if language == "zh" else 0.8
    return {
        "language": language,
        "score": score,
        "sentiment": "positive",
        "raw_score": {"label": "positive", "score": score},
=======
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
>>>>>>> origin/main
    }
<<<<<<< HEAD
    
    data = {
        "model": os.getenv("DEEPSEEK_MODEL_R1", "deepseek-reasoner"),  # Use R1 model by default
        "messages": [
            {"role": "system", "content": "You are a sentiment analysis expert. Provide sentiment analysis results in a consistent format: one word (POSITIVE/NEGATIVE/NEUTRAL) followed by a confidence score (0-1)."},
            {"role": "user", "content": f"Text to analyze ({language}): {text}"}
        ],
        "temperature": float(os.getenv("DEEPSEEK_TEMPERATURE", "0.1")),
        "max_tokens": int(os.getenv("DEEPSEEK_MAX_TOKENS", "50"))
    }
    
    async with aiohttp.ClientSession() as session:
        for attempt in range(retry_count):
            try:
                async with session.post(
                    f"{DEEPSEEK_API_URL}/chat/completions",
                    headers=headers,
                    json=data,
                    timeout=30
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        content = result["choices"][0]["message"]["content"].strip().upper()
                        words = content.split()
                        
                        sentiment = "neutral"
                        score = 0.5
                        
                        if words and words[0] in ["POSITIVE", "NEGATIVE", "NEUTRAL"]:
                            sentiment = words[0].lower()
                            try:
                                if len(words) > 1:
                                    score = float(words[-1])
                                    score = max(0.0, min(1.0, score))
                            except (ValueError, IndexError):
                                pass
                            
                        return {
                            "language": language,
                            "score": score,
                            "sentiment": sentiment,
                            "raw_score": {"label": sentiment, "score": score},
                            "analysis": content,
                            "model": data["model"]
                        }
                    elif response.status == 401:
                        raise ValueError("Invalid API key or unauthorized access")
                    elif response.status == 429:
                        if attempt < retry_count - 1:
                            await asyncio.sleep(2 ** attempt)  # Exponential backoff
                            continue
                        raise ValueError("Rate limit exceeded")
                    else:
                        error_msg = await response.text()
                        if attempt == retry_count - 1:
                            raise Exception(f"DeepSeek API error ({response.status}): {error_msg}")
            except aiohttp.ClientError as e:
                if attempt == retry_count - 1:
                    raise Exception(f"Network error: {str(e)}")
                await asyncio.sleep(1)
                continue
            except Exception as e:
                if attempt == retry_count - 1:
                    raise Exception(f"Failed to analyze text: {str(e)}")
                continue
    
    raise Exception("Failed to analyze text after all retries")
||||||| 8d442a778
=======
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
>>>>>>> origin/main
