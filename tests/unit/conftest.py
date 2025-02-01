import pytest
import os
import sys

# Add project root to Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))


@pytest.fixture
def mock_model_config():
    return {
        "AI_MODEL_MODE": "LOCAL",
        "LOCAL_MODEL_NAME": "deepseek-coder:1.5b",
        "LOCAL_MODEL_ENDPOINT": "http://localhost:11434",
        "TEMPERATURE": 0.7,
    }
