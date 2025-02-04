"""Tests for DEX service implementations."""

from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest
from trading_agent.dex_services.jupiter import JupiterService
from trading_agent.dex_services.uniswap import UniswapService


@pytest.fixture
async def uniswap_service():
    """Create Uniswap service instance."""
    with patch.dict(
        "os.environ", {"ETHEREUM_RPC_URL": "https://eth-mainnet.example.com"}
    ):
        service = UniswapService()
        await service.initialize()
        yield service
        await service.close()


@pytest.fixture
async def jupiter_service():
    """Create Jupiter service instance."""
    with patch.dict(
        "os.environ", {"SOLANA_RPC_URL": "https://api.mainnet-beta.solana.com"}
    ):
        service = JupiterService()
        await service.initialize()
        yield service
        await service.close()


@pytest.mark.asyncio
async def test_uniswap_initialization():
    """Test Uniswap service initialization."""
    with patch.dict(
        "os.environ", {"ETHEREUM_RPC_URL": "https://eth-mainnet.example.com"}
    ):
        service = UniswapService()

        # Mock session response
        with patch("aiohttp.ClientSession") as mock_session:
            mock_session.return_value.get = AsyncMock()
            mock_session.return_value.get.return_value.__aenter__.return_value.status = (
                200
            )

            success = await service.initialize()
            assert success is True
            assert service._initialized is True

            await service.close()


@pytest.mark.asyncio
async def test_jupiter_initialization():
    """Test Jupiter service initialization."""
    with patch.dict(
        "os.environ", {"SOLANA_RPC_URL": "https://api.mainnet-beta.solana.com"}
    ):
        service = JupiterService()

        # Mock session response
        with patch("aiohttp.ClientSession") as mock_session:
            mock_session.return_value.get = AsyncMock()
            mock_session.return_value.get.return_value.__aenter__.return_value.status = (
                200
            )

            success = await service.initialize()
            assert success is True
            assert service._initialized is True

            await service.close()


@pytest.mark.asyncio
async def test_uniswap_get_quote(uniswap_service):
    """Test Uniswap quote retrieval."""
    mock_response = {
        "id": "test_quote",
        "amountIn": "1000000000000000000",
        "amountOut": "2000000000000000000",
        "priceImpact": "0.001",
        "fee": "0.003",
        "route": [],
    }

    with patch.object(uniswap_service.session, "get") as mock_get:
        mock_get.return_value.__aenter__.return_value.status = 200
        mock_get.return_value.__aenter__.return_value.json = AsyncMock(
            return_value=mock_response
        )

        quote = await uniswap_service.get_quote(
            token_in="0x...", token_out="0x...", amount_in=Decimal("1.0")
        )

        assert quote["quote_id"] == "test_quote"
        assert float(quote["amount_in"]) == 1.0
        assert float(quote["amount_out"]) == 2.0


@pytest.mark.asyncio
async def test_jupiter_get_quote(jupiter_service):
    """Test Jupiter quote retrieval."""
    mock_response = {
        "quoteId": "test_quote",
        "inAmount": "1000000000",  # 1 SOL in lamports
        "outAmount": "2000000000",  # 2 SOL in lamports
        "priceImpactPct": "0.1",
        "routePlan": [],
    }

    with patch.object(jupiter_service.session, "get") as mock_get:
        mock_get.return_value.__aenter__.return_value.status = 200
        mock_get.return_value.__aenter__.return_value.json = AsyncMock(
            return_value=mock_response
        )

        quote = await jupiter_service.get_quote(
            token_in="SOL", token_out="USDC", amount_in=Decimal("1.0")
        )

        assert quote["quote_id"] == "test_quote"
        assert float(quote["amount_in"]) == 1.0
        assert float(quote["amount_out"]) == 2.0


@pytest.mark.asyncio
async def test_uniswap_execute_swap(uniswap_service):
    """Test Uniswap swap execution."""
    mock_quote_response = {
        "id": "test_quote",
        "amountIn": "1000000000000000000",
        "amountOut": "2000000000000000000",
        "priceImpact": "0.001",
        "fee": "0.003",
        "route": [],
    }

    mock_swap_response = {
        "hash": "0x...",
        "amountIn": "1000000000000000000",
        "amountOut": "2000000000000000000",
        "priceImpact": "0.001",
        "status": "success",
    }

    with patch.object(uniswap_service.session, "get") as mock_get, \
         patch.object(uniswap_service.session, "post") as mock_post:
        mock_get.return_value.__aenter__.return_value.status = 200
        mock_get.return_value.__aenter__.return_value.json = AsyncMock(
            return_value=mock_quote_response
        )

        mock_post.return_value.__aenter__.return_value.status = 200
        mock_post.return_value.__aenter__.return_value.json = AsyncMock(
            return_value=mock_swap_response
        )

        result = await uniswap_service.execute_swap(
            token_in="0x...",
            token_out="0x...",
            amount_in=Decimal("1.0"),
            min_amount_out=Decimal("1.9"),
            wallet_address="0x...",
        )

        assert result["transaction_hash"] == "0x..."
        assert float(result["amount_in"]) == 1.0
        assert float(result["amount_out"]) == 2.0
        assert result["status"] == "success"


@pytest.mark.asyncio
async def test_jupiter_execute_swap(jupiter_service):
    """Test Jupiter swap execution."""
    mock_quote_response = {
        "quoteId": "test_quote",
        "inAmount": "1000000000",
        "outAmount": "2000000000",
        "priceImpactPct": "0.1",
        "routePlan": [],
    }

    mock_swap_response = {
        "txid": "test_tx",
        "inAmount": "1000000000",
        "outAmount": "2000000000",
        "priceImpactPct": "0.1",
        "status": "success",
    }

    with patch.object(jupiter_service.session, "get") as mock_get:
        with patch.object(jupiter_service.session, "post") as mock_post:
            mock_get.return_value.__aenter__.return_value.status = 200
            mock_get.return_value.__aenter__.return_value.json = AsyncMock(
                return_value=mock_quote_response
            )

        mock_post.return_value.__aenter__.return_value.status = 200
        mock_post.return_value.__aenter__.return_value.json = AsyncMock(
            return_value=mock_swap_response
        )

        result = await jupiter_service.execute_swap(
            token_in="SOL",
            token_out="USDC",
            amount_in=Decimal("1.0"),
            min_amount_out=Decimal("1.9"),
            wallet_address="test_wallet",
        )

        assert result["transaction_hash"] == "test_tx"
        assert float(result["amount_in"]) == 1.0
        assert float(result["amount_out"]) == 2.0
        assert result["status"] == "success"


@pytest.mark.asyncio
async def test_cross_dex_liquidity(jupiter_service):
    """Test cross-DEX liquidity aggregation."""
    mock_liquidity_response = {
        "total_liquidity": "100000000000",
        "dex_breakdown": [
            {
                "dex": "Orca",
                "liquidity": "50000000000",
                "price": "24.5",
                "slippage": "0.1"
            },
            {
                "dex": "Raydium",
                "liquidity": "30000000000",
                "price": "24.48",
                "slippage": "0.15"
            },
            {
                "dex": "Serum",
                "liquidity": "20000000000",
                "price": "24.52",
                "slippage": "0.2"
            }
        ],
        "best_route": {
            "amount_in": "1000000000",
            "amount_out": "24500000000",
            "price_impact": "0.05",
            "dexes": ["Orca", "Raydium"]
        }
    }

    with patch.object(jupiter_service.session, "get") as mock_get:
        mock_get.return_value.__aenter__.return_value.status = 200
        mock_get.return_value.__aenter__.return_value.json = AsyncMock(
            return_value=mock_liquidity_response
        )

        liquidity = await jupiter_service.get_aggregated_liquidity("SOL/USDC")
        
        assert "total_liquidity" in liquidity
        assert float(liquidity["total_liquidity"]) == 100000000000
        assert "dex_breakdown" in liquidity
        assert len(liquidity["dex_breakdown"]) == 3
        assert "best_route" in liquidity
        assert len(liquidity["best_route"]["dexes"]) == 2
        assert float(liquidity["best_route"]["price_impact"]) < 0.1
