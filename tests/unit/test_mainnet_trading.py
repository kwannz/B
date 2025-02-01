"""Test script for verifying trading functionality on Solana mainnet."""

import asyncio
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, Optional

import aiohttp
import base58
from solana.keypair import Keypair
from solana.rpc.async_api import AsyncClient
from solana.rpc.commitment import Commitment
from solana.transaction import Transaction

# Add project root to Python path
project_root = str(Path(__file__).parent.parent)
sys.path.insert(0, project_root)

from src.trading_agent.strategies.solana_meme import SolanaMemeStrategy

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Test configuration
TEST_CONFIG = {
    "rpc_url": "https://api.mainnet-beta.solana.com",
    "jupiter_api": "https://quote-api.jup.ag/v6",
    "input_mint": "So11111111111111111111111111111111111111112",  # SOL
    "output_mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  # USDC
    "amount": "10000000",  # 0.01 SOL
    "slippage": 1.0,  # 1%
    "wallet_config": {
        "network": "mainnet",
        "min_balance": 0.05,  # Minimum SOL balance required
        "trade_amount": 0.01,  # Amount to use for test trades
    },
}


async def test_price_feed():
    """Test price feed functionality using Jupiter API."""
    try:
        async with aiohttp.ClientSession() as session:
            url = f"{TEST_CONFIG['jupiter_api']}/quote"
            params = {
                "inputMint": TEST_CONFIG["input_mint"],
                "outputMint": TEST_CONFIG["output_mint"],
                "amount": str(int(1e9)),  # 1 SOL
                "slippageBps": "100",  # 1%
                "asLegacyTransaction": "true",
            }

            # Add delay to respect rate limits
            await asyncio.sleep(1)

            logger.info("Requesting SOL/USDC price quote...")
            async with session.get(url, params=params) as response:
                if response.status == 429:  # Rate limit exceeded
                    logger.warning("Rate limit exceeded, waiting 60 seconds...")
                    await asyncio.sleep(60)
                    # Retry the request
                    async with session.get(url, params=params) as retry_response:
                        if retry_response.status == 200:
                            data = await retry_response.json()
                            if isinstance(data, dict) and "outAmount" in data:
                                out_amount = (
                                    int(data["outAmount"]) / 1e6
                                )  # USDC decimals
                                in_amount = int(data["inAmount"]) / 1e9  # SOL decimals
                                price = out_amount / in_amount if in_amount > 0 else 0
                                logger.info(f"Current SOL price: ${price:.2f}")
                                return True
                            logger.error(f"Invalid quote response format: {data}")
                        return False
                    data = await response.json()
                    if isinstance(data, dict) and "outAmount" in data:
                        out_amount = int(data["outAmount"]) / 1e6  # USDC decimals
                        in_amount = int(data["inAmount"]) / 1e9  # SOL decimals
                        price = out_amount / in_amount if in_amount > 0 else 0
                        logger.info(f"Current SOL price: ${price:.2f}")
                        return True
                    logger.error(f"Invalid quote response format: {data}")
                else:
                    error_text = await response.text()
                    logger.error(
                        f"Quote API failed with status {response.status}: {error_text}"
                    )
                return False
    except Exception as e:
        logger.error(f"Price feed test failed: {str(e)}")
        return False


async def test_dex_quotes():
    """Test DEX quote functionality using Jupiter API."""
    try:
        async with aiohttp.ClientSession() as session:
            url = f"{TEST_CONFIG['jupiter_api']}/quote"
            params = {
                "inputMint": TEST_CONFIG["input_mint"],
                "outputMint": TEST_CONFIG["output_mint"],
                "amount": TEST_CONFIG["amount"],
                "slippageBps": int(TEST_CONFIG["slippage"] * 100),
            }

            # Add delay to respect rate limits
            await asyncio.sleep(1)

            async with session.get(url, params=params) as response:
                if response.status == 429:  # Rate limit exceeded
                    logger.warning("Rate limit exceeded, waiting 60 seconds...")
                    await asyncio.sleep(60)
                    # Retry the request
                    async with session.get(url, params=params) as retry_response:
                        if retry_response.status == 200:
                            data = await retry_response.json()
                            if isinstance(data, dict) and "outAmount" in data:
                                logger.info(
                                    f"Got quote from Jupiter: {json.dumps(data, indent=2)}"
                                )
                                return True
                            logger.error(f"Invalid quote format: {data}")
                            return False
                        logger.error(
                            f"Failed to get quote: {await retry_response.text()}"
                        )
                        return False
                if response.status == 200:
                    data = await response.json()
                    if isinstance(data, dict) and "outAmount" in data:
                        logger.info(
                            f"Got quote from Jupiter: {json.dumps(data, indent=2)}"
                        )
                        return True
                    logger.error(f"Invalid quote format: {data}")
                    return False
                logger.error(f"Failed to get quote: {await response.text()}")
                return False
    except Exception as e:
        logger.error(f"DEX quote test failed: {str(e)}")
        return False


async def test_wallet_operations():
    """Test wallet operations."""
    try:
        # Use the provided wallet address
        wallet_address = "2Dn5WycHM4tgiRx6QSyufGkcMjyxwAqR7fJiitJCUAcA"
        logger.info(f"Using existing wallet: {wallet_address}")

        # Initialize Solana client
        client = AsyncClient(TEST_CONFIG["rpc_url"])

        try:
            # Test RPC connection
            version = await client.get_version()
            logger.info(f"Connected to Solana mainnet version: {version['result']}")

            # Check wallet balance
            balance = await client.get_balance(wallet_address)
            if "result" in balance:
                current_balance = balance["result"]["value"] / 1e9
                logger.info(f"Current wallet balance: {current_balance} SOL")

                if current_balance >= TEST_CONFIG["wallet_config"]["min_balance"]:
                    logger.info("Wallet has sufficient balance for testing")
                    return True
                else:
                    logger.warning(
                        f"Insufficient balance. Required: {TEST_CONFIG['wallet_config']['min_balance']} SOL"
                    )
            else:
                logger.error("Failed to get wallet balance")
            return False

        except Exception as e:
            logger.error(f"Failed to connect to Solana mainnet: {str(e)}")
            return False

    except Exception as e:
        logger.error(f"Wallet operations test failed: {str(e)}")
        return False
    finally:
        await client.close()


async def main():
    """Run all mainnet trading tests."""
    logger.info("Starting mainnet trading tests...")

    # Ensure we're using mainnet
    os.environ["SOLANA_RPC_URL"] = TEST_CONFIG["rpc_url"]

    tests = [
        ("Wallet Operations", test_wallet_operations()),
        ("Price Feed", test_price_feed()),
        ("DEX Quotes", test_dex_quotes()),
    ]

    results = []
    for test_name, test_coro in tests:
        logger.info(f"Running test: {test_name}")
        result = await test_coro
        results.append(result)
        logger.info(f"Test {test_name}: {'PASSED' if result else 'FAILED'}")

    success = all(results)
    logger.info(
        f"Mainnet trading tests {'completed successfully' if success else 'failed'}"
    )
    return success


if __name__ == "__main__":
    asyncio.run(main())
