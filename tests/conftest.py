import pytest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

@pytest.fixture
def mock_model_config(monkeypatch):
    config = {
        "AI_MODEL_MODE": "LOCAL",
        "LOCAL_MODEL_NAME": "sentiment-analyzer:v1",
        "LOCAL_MODEL_ENDPOINT": "http://localhost:11434",
        "TEMPERATURE": 0.1
    }
    for key, value in config.items():
        monkeypatch.setenv(key, str(value))
    return config
