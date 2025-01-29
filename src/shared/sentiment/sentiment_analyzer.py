from typing import Dict, Any, Optional
import aiohttp
import asyncio
import json
import os
from datetime import datetime

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
    }
    
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
