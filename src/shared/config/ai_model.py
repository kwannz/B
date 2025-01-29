import os

# Model deployment mode
AI_MODEL_MODE = os.getenv("AI_MODEL_MODE", "REMOTE")

# Model endpoints
LOCAL_MODEL_ENDPOINT = "http://localhost:11434"
REMOTE_MODEL_ENDPOINT = os.getenv("DEEPSEEK_API_URL", "https://api.deepseek.com/v3/completions")

# Model configurations
LOCAL_MODEL_NAME = os.getenv("LOCAL_MODEL_NAME", "sentiment-analyzer")
REMOTE_MODEL_NAME = os.getenv("DEEPSEEK_MODEL", "deepseek-v3")

# API configuration
API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
TEMPERATURE = float(os.getenv("DEEPSEEK_TEMPERATURE", "0.7"))
MIN_CONFIDENCE = float(os.getenv("DEEPSEEK_MIN_CONFIDENCE", "0.7"))
MAX_RETRIES = int(os.getenv("DEEPSEEK_MAX_RETRIES", "3"))
RETRY_DELAY = float(os.getenv("DEEPSEEK_RETRY_DELAY", "2.0"))
