import os
from dataclasses import dataclass

@dataclass
class DeepSeekModelConfig:
    MODEL_NAME: str = "deepseek-1.5b"
    QUANTIZATION: str = "4bit"
    BATCH_SIZE: int = 16
    MAX_SEQ_LEN: int = 2048
    DEVICE: str = "cuda:0"
    API_KEY: str = os.getenv("DEEPSEEK_API_KEY", "")
    TEMPERATURE: float = 0.7
    MIN_CONFIDENCE: float = 0.7
    MAX_RETRIES: int = 3
    RETRY_DELAY: float = 2.0

    @property
    def is_quantized(self) -> bool:
        return self.QUANTIZATION == "4bit"

MODEL_CONFIG = DeepSeekModelConfig()
