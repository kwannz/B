import os
from dataclasses import dataclass

AI_MODEL_MODE = os.getenv("AI_MODEL_MODE", "LOCAL")
LOCAL_MODEL_ENDPOINT = os.getenv("LOCAL_MODEL_ENDPOINT", "http://localhost:11434")
REMOTE_MODEL_ENDPOINT = os.getenv("REMOTE_MODEL_ENDPOINT", "https://api.deepseek.com")
LOCAL_MODEL_NAME = "deepseek-1.5b"
REMOTE_MODEL_NAME = "deepseek-r1"
API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
TEMPERATURE = 0.7
MIN_CONFIDENCE = 0.7
MAX_RETRIES = 3
RETRY_DELAY = 2.0

@dataclass
class DeepSeekModelConfig:
    MODEL_NAME: str = LOCAL_MODEL_NAME if AI_MODEL_MODE == "LOCAL" else REMOTE_MODEL_NAME
    QUANTIZATION: str = "4bit"
    BATCH_SIZE: int = 16
    MAX_SEQ_LEN: int = 2048
    DEVICE: str = "cuda:0"
    API_KEY: str = API_KEY
    TEMPERATURE: float = TEMPERATURE
    MIN_CONFIDENCE: float = MIN_CONFIDENCE
    MAX_RETRIES: int = MAX_RETRIES
    RETRY_DELAY: float = RETRY_DELAY

    @property
    def is_quantized(self) -> bool:
        return self.QUANTIZATION == "4bit"

MODEL_CONFIG = DeepSeekModelConfig()
