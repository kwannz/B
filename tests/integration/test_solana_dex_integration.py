"""Unit tests for Solana DEX integration."""

import pytest
import asyncio
from decimal import Decimal
from unittest.mock import patch, MagicMock
import requests

from tradingbot.shared.modules.solana_dex_integration import (
    SolanaDEXIntegration,
    TradeConfig,
)


@pytest.fixture
def dex_config():
    """Create test DEX configuration."""
    return {
        "api_url": "https://quote-api.jup.ag/v6",
        "slippage_bps": 100,  # 1% slippage
        "timeout_ms": 10000,  # 10s timeout
        "price_thresholds": {"SOL-USDC": {"buy": 0.04, "sell": 0.07}},
    }


@pytest.fixture
def mock_quote_response():
    """Create mock quote response."""
    return {
        "routes": [
            {
                "inAmount": "1000000",  # 1 SOL
                "outAmount": "24500000",  # 24.5 USDC
                "priceImpactPct": 0.1,
                "marketInfos": [
                    {
                        "id": "test_market",
                        "label": "Orca",
                        "inputMint": "SOL",
                        "outputMint": "USDC",
                        "notEnoughLiquidity": False,
                        "liquidityFee": 100000,  # 0.1 SOL
                    }
                ],
                "amount": "1000000",
                "slippageBps": 100,
                "otherAmountThreshold": "24000000",  # Min USDC to receive
                "swapMode": "ExactIn",
            }
        ],
        "networkFee": 5000,  # 0.005 SOL
        "platformFee": 1000,  # 0.001 SOL
    }


@pytest.fixture
def mock_swap_response():
    """Create mock swap response."""
    return {
        "swapTransaction": "base64_encoded_transaction",
        "signature": "test_signature",
    }


@pytest.fixture
def mock_status_response():
    """Create mock transaction status response."""
    return {"signature": "test_signature", "confirmed": True, "slot": 123456789}


async def test_initialization(dex_config):
    """Test DEX integration initialization."""
    dex = SolanaDEXIntegration(dex_config)
    assert dex.api_url == "https://quote-api.jup.ag/v6"
    assert dex.slippage_bps == 100
    assert dex.timeout_ms == 10000
    assert "SOL-USDC" in dex.price_thresholds


async def test_get_quote(dex_config, mock_quote_response):
    """Test quote retrieval."""
    with patch("requests.get") as mock_get:
        mock_get.return_value.json.return_value = mock_quote_response
        mock_get.return_value.status_code = 200

        dex = SolanaDEXIntegration(dex_config)
        trade_config = TradeConfig(
            input_mint="SOL", output_mint="USDC", amount=1000000  # 1 SOL
        )

        quote = await dex.get_quote(trade_config)
        assert quote == mock_quote_response
        assert len(quote["routes"]) > 0
        assert quote["routes"][0]["inAmount"] == "1000000"


async def test_get_swap_instruction(
    dex_config, mock_quote_response, mock_swap_response
):
    """Test swap instruction generation."""
    with patch("requests.post") as mock_post:
        mock_post.return_value.json.return_value = mock_swap_response
        mock_post.return_value.status_code = 200

        dex = SolanaDEXIntegration(dex_config)
        swap_instruction = await dex.get_swap_instruction(
            mock_quote_response, "test_public_key"
        )

        assert swap_instruction == mock_swap_response
        assert "swapTransaction" in swap_instruction
        assert swap_instruction["signature"] == "test_signature"


async def test_check_price_threshold(dex_config, mock_quote_response):
    """Test price threshold checking."""
    with patch("requests.get") as mock_get:
        mock_get.return_value.json.return_value = mock_quote_response
        mock_get.return_value.status_code = 200

        dex = SolanaDEXIntegration(dex_config)
        signal = await dex.check_price_threshold(
            input_mint="SOL", output_mint="USDC", amount=1000000  # 1 SOL
        )

        # Price is 24.5 USDC per SOL, above sell threshold
        assert signal == "sell"


async def test_calculate_fees(dex_config, mock_quote_response):
    """Test fee calculation."""
    dex = SolanaDEXIntegration(dex_config)
    fees = await dex.calculate_fees(mock_quote_response)

    assert fees["network_fee"] == 5000
    assert fees["platform_fee"] == 1000
    assert fees["total_fee"] == 6000
    assert fees["fee_token"] == "SOL"


async def test_get_transaction_status(dex_config, mock_status_response):
    """Test transaction status monitoring."""
    with patch("requests.get") as mock_get:
        mock_get.return_value.json.return_value = mock_status_response
        mock_get.return_value.status_code = 200

        dex = SolanaDEXIntegration(dex_config)
        status = await dex.get_transaction_status(
            signature="test_signature", max_retries=1, retry_delay=0.1
        )

        assert status == mock_status_response
        assert status["confirmed"] is True


async def test_error_handling(dex_config):
    """Test error handling and retries."""
    with patch("requests.get") as mock_get:
        mock_get.side_effect = requests.exceptions.RequestException("API error")

        dex = SolanaDEXIntegration(dex_config)
        trade_config = TradeConfig(input_mint="SOL", output_mint="USDC", amount=1000000)

        with pytest.raises(requests.exceptions.RequestException):
            await dex.get_quote(trade_config)


async def test_invalid_config():
    """Test configuration validation."""
    with pytest.raises(ValueError):
        SolanaDEXIntegration({"api_url": ""})

    with pytest.raises(ValueError):
        SolanaDEXIntegration({"api_url": "test", "slippage_bps": -1})
