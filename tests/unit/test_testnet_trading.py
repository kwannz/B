"""Test script for verifying trading functionality on Solana testnet."""

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
    "rpc_url": "https://api.devnet.solana.com",
    "jupiter_api": "https://quote-api.jup.ag/v6",
    "input_mint": "So11111111111111111111111111111111111111112",  # SOL
    "output_mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  # USDC
    "amount": "10000000",  # 0.01 SOL
    "slippage": 1.0,  # 1%
    "wallet_config": {
        "network": "devnet",
        "min_balance": 0.05,  # Minimum SOL balance required
        "test_amount": 0.1,  # Amount to request from faucet
        "trade_amount": 0.01,  # Amount to use for test trades
    },
}


async def test_price_feed():
    """Test price feed functionality using Jupiter API."""
    try:
        async with aiohttp.ClientSession() as session:
            # Use quote endpoint for price discovery
            url = f"{TEST_CONFIG['jupiter_api']}/quote"
            params = {
                "inputMint": TEST_CONFIG["input_mint"],
                "outputMint": TEST_CONFIG["output_mint"],
                "amount": str(int(1e9)),  # 1 SOL
                "slippageBps": "100",  # 1%
                "asLegacyTransaction": "true",
            }

            logger.info("Requesting SOL/USDC price quote...")
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    logger.debug(f"Quote API response: {data}")

                    if isinstance(data, dict) and "outAmount" in data:
                        # Calculate price (USDC per SOL)
                        out_amount = int(data["outAmount"]) / 1e6  # USDC decimals
                        in_amount = int(data["inAmount"]) / 1e9  # SOL decimals
                        price = out_amount / in_amount if in_amount > 0 else 0
                        logger.info(f"Current SOL price: ${price:.2f}")

                        # Log additional quote details
                        if "priceImpactPct" in data:
                            impact = float(data["priceImpactPct"])
                            logger.info(f"Price impact: {impact:.4f}%")

                        if "routePlan" in data:
                            route_count = len(data["routePlan"])
                            logger.info(f"Found {route_count} route steps")

                        return True
                    else:
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
            async with session.get(url, params=params) as response:
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


async def test_route_aggregation():
    """Test DEX route aggregation using Jupiter API."""
    try:
        async with aiohttp.ClientSession() as session:
            url = f"{TEST_CONFIG['jupiter_api']}/quote"
            params = {
                "inputMint": TEST_CONFIG["input_mint"],
                "outputMint": TEST_CONFIG["output_mint"],
                "amount": str(TEST_CONFIG["amount"]),  # Convert to string
                "slippageBps": str(
                    int(TEST_CONFIG["slippage"] * 100)
                ),  # Convert to string
                "onlyDirectRoutes": "false",  # Use string instead of boolean
                "asLegacyTransaction": "true",  # Use string instead of boolean
            }

            logger.info("Requesting route quote with params:")
            logger.info(f"  Input: {TEST_CONFIG['input_mint']} (SOL)")
            logger.info(f"  Output: {TEST_CONFIG['output_mint']} (USDC)")
            logger.info(f"  Amount: {int(TEST_CONFIG['amount'])/1e9:.6f} SOL")
            logger.info(f"  Slippage: {TEST_CONFIG['slippage']}%")

            async with session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    logger.debug(f"Route API response: {data}")

                    if isinstance(data, dict) and "routePlan" in data:
                        route_plan = data.get("routePlan", [])

                        if route_plan:
                            logger.info(f"Found {len(route_plan)} route steps")
                            total_input_amount = 0
                            total_output_amount = 0
                            total_fees = 0

                            # Log route details
                            logger.info("\nRoute details:")
                            for i, step in enumerate(route_plan):
                                swap_info = step.get("swapInfo", {})
                                if not isinstance(swap_info, dict):
                                    logger.warning(
                                        f"Invalid swap info format in step {i + 1}"
                                    )
                                    continue

                                try:
                                    in_amount = int(swap_info.get("inAmount", "0"))
                                    out_amount = int(swap_info.get("outAmount", "0"))
                                    fee_amount = int(swap_info.get("feeAmount", "0"))

                                    logger.info(f"\nStep {i + 1}:")
                                    logger.info(
                                        f"  DEX: {swap_info.get('label', 'Unknown')}"
                                    )
                                    logger.info(
                                        f"  Input Amount: {in_amount/1e9:.6f} SOL"
                                    )
                                    logger.info(
                                        f"  Output Amount: {out_amount/1e6:.6f} USDC"
                                    )
                                    logger.info(
                                        f"  Fee Amount: {fee_amount/1e9:.6f} SOL"
                                    )

                                    total_input_amount += in_amount
                                    total_output_amount += out_amount
                                    total_fees += fee_amount
                                except (ValueError, TypeError) as e:
                                    logger.warning(
                                        f"Error parsing amounts in step {i + 1}: {str(e)}"
                                    )

                            # Log totals
                            logger.info("\nRoute Summary:")
                            logger.info(
                                f"Total Input: {total_input_amount/1e9:.6f} SOL"
                            )
                            logger.info(
                                f"Total Output: {total_output_amount/1e6:.6f} USDC"
                            )
                            logger.info(f"Total Fees: {total_fees/1e9:.6f} SOL")

                            # Calculate effective price
                            if total_input_amount > 0:
                                effective_price = (total_output_amount / 1e6) / (
                                    total_input_amount / 1e9
                                )
                                logger.info(
                                    f"Effective Price: ${effective_price:.2f} per SOL"
                                )

                            # Get price impact if available
                            price_impact = data.get("priceImpactPct")
                            if price_impact is not None:
                                try:
                                    impact = float(price_impact)
                                    logger.info(f"Price Impact: {impact:.4f}%")
                                except (ValueError, TypeError):
                                    logger.warning(
                                        f"Invalid price impact format: {price_impact}"
                                    )

                            return True
                        else:
                            logger.error("No valid routes found in response")
                    else:
                        logger.error(f"Invalid response format: {data}")
                else:
                    error_text = await response.text()
                    logger.error(
                        f"Route API failed with status {response.status}: {error_text}"
                    )
                return False
    except Exception as e:
        logger.error(f"Route aggregation test failed: {str(e)}", exc_info=True)
        return False


async def wait_for_confirmation(
    client: AsyncClient, signature: str, max_retries: int = 30
) -> bool:
    """Wait for transaction confirmation."""
    retries = 0
    while retries < max_retries:
        try:
            resp = await client.get_signature_statuses([signature])
            if resp["result"]["value"][0] is not None:
                conf = resp["result"]["value"][0]["confirmationStatus"]
                if conf == "confirmed" or conf == "finalized":
                    return True
        except Exception as e:
            logger.warning(f"Error checking confirmation: {str(e)}")
        await asyncio.sleep(1)
        retries += 1
    return False


async def request_airdrop_from_faucet(wallet_address: str) -> bool:
    """Request SOL from QuickNode faucet."""
    try:
        async with aiohttp.ClientSession() as session:
            # Try QuickNode faucet first
            url = "https://faucet.quicknode.com/solana/devnet"
            params = {"recipient": wallet_address}
            logger.info("Requesting SOL from QuickNode faucet...")
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    logger.info("QuickNode faucet request successful")
                    return True
                else:
                    error_text = await response.text()
                    logger.warning(f"QuickNode faucet request failed: {error_text}")

            # Try alternative faucet
            url = "https://faucet.nishantcoder.com/request"
            data = {"address": wallet_address, "network": "devnet", "amount": 1}
            logger.info("Trying alternative faucet...")
            async with session.post(url, json=data) as response:
                if response.status == 200:
                    logger.info("Alternative faucet request successful")
                    return True
                else:
                    error_text = await response.text()
                    logger.warning(f"Alternative faucet request failed: {error_text}")
                    return False
    except Exception as e:
        logger.error(f"Error requesting from faucets: {str(e)}")
        return False


async def test_wallet_operations():
    """Test wallet creation and operations."""
    try:
        # Use the provided wallet address
        wallet_address = "2Dn5WycHM4tgiRx6QSyufGkcMjyxwAqR7fJiitJCUAcA"
        logger.info(f"Using existing wallet: {wallet_address}")

        # Initialize Solana client with devnet
        client = AsyncClient(TEST_CONFIG["rpc_url"])

        try:
            # Test RPC connection first
            version = await client.get_version()
            logger.info(f"Connected to Solana devnet version: {version['result']}")

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
            logger.error(f"Failed to connect to Solana devnet: {str(e)}")
            return False

    except Exception as e:
        logger.error(f"Wallet operations test failed: {str(e)}")
        return False
    finally:
        await client.close()


async def main():
    """Run all testnet trading tests."""
    logger.info("Starting devnet trading tests...")

    # Ensure we're using devnet
    os.environ["SOLANA_RPC_URL"] = TEST_CONFIG["rpc_url"]

    tests = [
        ("Wallet Operations", test_wallet_operations()),
        ("Price Feed", test_price_feed()),
        ("DEX Quotes", test_dex_quotes()),
        ("Route Aggregation", test_route_aggregation()),
    ]

    results = []
    for test_name, test_coro in tests:
        logger.info(f"Running test: {test_name}")
        result = await test_coro
        results.append(result)
        logger.info(f"Test {test_name}: {'PASSED' if result else 'FAILED'}")

    success = all(results)
    logger.info(
        f"Testnet trading tests {'completed successfully' if success else 'failed'}"
    )
    return success


if __name__ == "__main__":
    asyncio.run(main())
