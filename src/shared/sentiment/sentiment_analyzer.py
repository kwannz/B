from typing import Dict, Any, Optional, Union
import aiohttp
import json
import os
from datetime import datetime
from decimal import Decimal
from functools import wraps

from src.shared.config.ai_model import (
    AI_MODEL_MODE, LOCAL_MODEL_ENDPOINT, REMOTE_MODEL_ENDPOINT,
    LOCAL_MODEL_NAME, REMOTE_MODEL_NAME, API_KEY, TEMPERATURE,
    MIN_CONFIDENCE, MAX_RETRIES, RETRY_DELAY
)

try:
    from tradingbot.shared.metrics.model_metrics import ModelMetrics
except ImportError:
    class ModelMetrics:
        @staticmethod
        def track_request(func):
            async def wrapper(*args, **kwargs):
                return await func(*args, **kwargs)
            return wrapper

async def call_local_model(session: Optional[aiohttp.ClientSession], text: str, language: str) -> Dict[str, Any]:
    if not isinstance(text, str) or not text.strip():
        raise ValueError("Text must be a non-empty string")
    
    if not isinstance(language, str) or language not in ["en", "zh"]:
        raise ValueError(f"Unsupported language: {language}")

    if not LOCAL_MODEL_ENDPOINT or not LOCAL_MODEL_NAME:
        raise ValueError("LOCAL_MODEL_ENDPOINT and LOCAL_MODEL_NAME must be set")

    # Determine endpoint based on environment
    endpoint = os.getenv('OLLAMA_API_BASE_URL') or (
        'http://ollama:11434' if os.getenv('DOCKER_ENV') == 'true' 
        else LOCAL_MODEL_ENDPOINT
    )
    print(f"Using endpoint: {endpoint}")
    print(f"Model: {LOCAL_MODEL_NAME}")

    # Configure client session with Docker-aware DNS resolution
    connector = aiohttp.TCPConnector(
        force_close=True,
        enable_cleanup_closed=True,
        use_dns_cache=True,
        ttl_dns_cache=300,
        verify_ssl=False,
        ssl=False,
        family=0
    )
    
    timeout = aiohttp.ClientTimeout(
        total=float(os.getenv('AIOHTTP_TOTAL_TIMEOUT', '120')),
        connect=float(os.getenv('AIOHTTP_CLIENT_TIMEOUT', '60'))
    )
    
    async with aiohttp.ClientSession(
        connector=connector,
        timeout=timeout,
        trust_env=True
    ) as local_session:
        try:
            health_check_url = f"{endpoint}/api/tags"
            print(f"Checking Ollama health at: {health_check_url}")
            async with local_session.get(health_check_url) as health_check:
                if health_check.status != 200:
                    print(f"Health check failed with status {health_check.status}")
                    raise ConnectionError(f"Ollama service health check failed with status {health_check.status}")
                health_data = await health_check.json()
                print(f"Health check response: {health_data}")
                print("Ollama service health check passed")
        except aiohttp.ClientError as e:
            print(f"Network error during health check: {str(e)}")
            raise ConnectionError(f"Failed to connect to Ollama service at {endpoint}: {str(e)}")
        except Exception as e:
            print(f"Unexpected error during health check: {str(e)}")
            raise ConnectionError(f"Failed to connect to Ollama service at {endpoint}: {str(e)}")
        
        prompt = f"""Analyze the sentiment of this {language} text and respond with only a JSON object containing 'score' (0-1) and 'label' (positive/negative).
Text: "{text}"
Response format: {{"score": 0.8, "label": "positive"}}"""

    data = {
        "model": str(LOCAL_MODEL_NAME),
        "prompt": str(prompt),
        "stream": False,
        "temperature": float(TEMPERATURE),
        "format": "json"
    }
    generate_url = f"{endpoint}/api/generate"
    print(f"Sending request to Ollama at {generate_url}: {data}")
    try:
        print(f"Sending request to {generate_url} with data: {data}")
        async with local_session.post(generate_url, json=data) as resp:
            if resp.status != 200:
                error_text = await resp.text()
                print(f"Ollama API error: Status {resp.status}, Response: {error_text}")
                raise Exception(f"Ollama API returned status {resp.status}: {error_text}")
            
            result = await resp.json()
            response_text = result.get("response", "")
            print(f"Ollama response: {response_text}")
            
            try:
                sentiment_data = json.loads(response_text)
            except json.JSONDecodeError:
                # Fallback to regex if response isn't pure JSON
                import re
                json_match = re.search(r'\{.*?\}', response_text)
                if not json_match:
                    raise ValueError(f"No JSON found in response: {response_text}")
                sentiment_data = json.loads(json_match.group(0))
            
            if not isinstance(sentiment_data, dict):
                raise ValueError(f"Invalid response format, expected dict but got: {type(sentiment_data)}")
            
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
    except aiohttp.ClientError as e:
        print(f"Network error calling Ollama: {str(e)}")
        raise ConnectionError(f"Failed to connect to Ollama service: {str(e)}")
    except (json.JSONDecodeError, ValueError) as e:
        print(f"Error processing Ollama response: {str(e)}")
        raise ValueError(f"Failed to parse Ollama response: {str(e)}")
    except Exception as e:
        print(f"Unexpected error processing Ollama response: {str(e)}")
        raise

async def call_remote_model(session: aiohttp.ClientSession, text: str, language: str) -> Dict[str, Any]:
    if not text:
        raise ValueError("Text cannot be empty")
    
    if language not in ["en", "zh"]:
        raise ValueError(f"Unsupported language: {language}")

    if not API_KEY:
        raise ValueError("API_KEY environment variable not set")
    
    if not REMOTE_MODEL_NAME:
        raise ValueError("REMOTE_MODEL_NAME environment variable not set")

    headers = {"Authorization": f"Bearer {API_KEY}"}
    data = {
        "model": REMOTE_MODEL_NAME,
        "messages": [
            {"role": "system", "content": "You are a sentiment analysis expert. Provide sentiment analysis results in a consistent format: one word (POSITIVE/NEGATIVE/NEUTRAL) followed by a confidence score (0-1)."},
            {"role": "user", "content": f"Text to analyze ({language}): {text}"}
        ],
        "temperature": TEMPERATURE,
        "max_tokens": 100
    }
    async with session.post(REMOTE_MODEL_ENDPOINT, headers=headers, json=data) as resp:
        if resp.status == 200:
            result = await resp.json()
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
                "timestamp": datetime.utcnow().isoformat(),
                "model": "remote"
            }
    raise Exception("Remote model failed to return valid response")

@ModelMetrics.track_request
def adjust_meme_sentiment(result: Dict[str, Any], is_meme: bool = False) -> Dict[str, Any]:
    if not is_meme:
        return result
        
    meme_multiplier = Decimal("1.1")
    confidence_threshold = Decimal("0.7")
    
    score = Decimal(str(result.get("score", 0.5)))
    raw_score = result.get("raw_score", {})
    confidence = Decimal(str(raw_score.get("score", 0.5)))
    
    if confidence >= confidence_threshold:
        adjusted_score = min(max(score * meme_multiplier, Decimal("0")), Decimal("1"))
        result["score"] = float(adjusted_score)
        result["raw_score"]["score"] = float(adjusted_score)
        result["is_meme_adjusted"] = True
        
    return result

async def analyze_text(text: Union[str, bytes], language: str = "en", is_meme: bool = False) -> Dict[str, Any]:
    if isinstance(text, bytes):
        text = text.decode('utf-8')
    elif not isinstance(text, str):
        text = str(text)
    
    if not text.strip():
        raise ValueError("Text cannot be empty")
    
    if language not in ["en", "zh"]:
        raise ValueError(f"Unsupported language: {language}")

    print(f"Starting sentiment analysis with mode: {AI_MODEL_MODE}")
    print(f"Environment configuration:")
    print(f"LOCAL_MODEL_ENDPOINT: {LOCAL_MODEL_ENDPOINT}")
    print(f"LOCAL_MODEL_NAME: {LOCAL_MODEL_NAME}")
    print(f"REMOTE_MODEL_ENDPOINT: {REMOTE_MODEL_ENDPOINT}")
    print(f"DOCKER_ENV: {os.getenv('DOCKER_ENV', 'false')}")
    
    try:
        if AI_MODEL_MODE != "REMOTE":
            try:
                print("Attempting local model analysis...")
                result = await call_local_model(None, text, language)
                print(f"Local model succeeded: {result}")
                return result
            except Exception as e:
                print(f"Local model failed: {str(e)}")
                if AI_MODEL_MODE == "LOCAL" and not os.getenv("ALLOW_REMOTE_FALLBACK", "true").lower() == "true":
                    raise e

        print("Attempting remote model analysis...")
        conn_timeout = aiohttp.ClientTimeout(
            total=float(os.getenv('AIOHTTP_TOTAL_TIMEOUT', '120')),
            connect=float(os.getenv('AIOHTTP_CLIENT_TIMEOUT', '60'))
        )
        async with aiohttp.ClientSession(timeout=conn_timeout) as session:
            result = await call_remote_model(session, text, language)
            print(f"Remote model succeeded: {result}")
            return adjust_meme_sentiment(result, is_meme)
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
            "model": "fallback",
            "is_meme_adjusted": False
        }
