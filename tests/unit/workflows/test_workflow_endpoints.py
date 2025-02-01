"""Test script for verifying the 6-step trading dashboard workflow."""

import asyncio
import json
import logging
import sys
from pathlib import Path

import httpx

# Add project root to Python path
project_root = str(Path(__file__).parent.parent)
sys.path.insert(0, project_root)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

API_BASE = "http://localhost:8000/api/v1"


async def test_workflow():
    """Test the complete trading dashboard workflow."""
    async with httpx.AsyncClient() as client:
        try:
            # Step 0: Register test user
            logger.info("Registering test user...")
            register_response = await client.post(
                f"{API_BASE}/auth/register",
                json={
                    "email": "test@example.com",
                    "password": "testpassword123",
                    "username": "testuser",
                },
            )
            if register_response.status_code != 200:
                logger.error(f"Registration failed: {register_response.text}")
                return

            auth_token = register_response.json()["access_token"]
            headers = {"Authorization": f"Bearer {auth_token}"}
            tenant_id = register_response.json()["tenant_id"]

            # Step 1: Agent Selection
            logger.info("Testing agent selection...")
            agent_response = await client.get(
                f"{API_BASE}/workflow/select_agent",
                params={"tenant_id": tenant_id},
                headers=headers,
            )
            if agent_response.status_code != 200:
                logger.error(f"Agent selection failed: {agent_response.text}")
                return

            # For testing, use the first available agent
            agents = agent_response.json()
            if not agents:
                logger.error("No agents available")
                return
            agent_id = agents[0]["id"]

            # Step 2: Strategy Creation
            logger.info("Testing strategy creation...")
            strategy_response = await client.post(
                f"{API_BASE}/workflow/strategy/create",
                headers=headers,
                json={
                    "tenant_id": tenant_id,
                    "agent_id": agent_id,
                    "strategy_type": "momentum",
                    "parameters": {"timeframe": "1h", "threshold": 0.02},
                },
            )
            if strategy_response.status_code != 200:
                logger.error(f"Strategy creation failed: {strategy_response.text}")
                return

            # Step 3: Bot Integration
            logger.info("Testing bot integration...")
            bot_response = await client.post(
                f"{API_BASE}/workflow/bot/integrate",
                headers=headers,
                json={
                    "tenant_id": tenant_id,
                    "agent_id": agent_id,
                    "bot_type": "momentum",
                    "config": {
                        "entry_threshold": 0.02,
                        "exit_threshold": 0.01,
                        "stop_loss": 0.05,
                    },
                },
            )
            if bot_response.status_code != 200:
                logger.error(f"Bot integration failed: {bot_response.text}")
                return

            # Step 4: Wallet Creation
            logger.info("Testing wallet creation...")
            wallet_response = await client.post(
                f"{API_BASE}/workflow/wallet/create",
                headers=headers,
                json={
                    "tenant_id": tenant_id,
                    "agent_id": agent_id,
                    "wallet_type": "trading",
                    "config": {"daily_limit": 1000, "risk_level": "medium"},
                },
            )
            if wallet_response.status_code != 200:
                logger.error(f"Wallet creation failed: {wallet_response.text}")
                return

            # Step 5: Key Management
            logger.info("Testing key management...")
            key_response = await client.post(
                f"{API_BASE}/workflow/key/manage",
                headers=headers,
                json={
                    "tenant_id": tenant_id,
                    "agent_id": agent_id,
                    "keys": {
                        "api_key": "test_api_key",
                        "api_secret": "test_api_secret",
                    },
                },
            )
            if key_response.status_code != 200:
                logger.error(f"Key management failed: {key_response.text}")
                return

            # Step 6: Status Display
            logger.info("Testing status display...")
            status_response = await client.get(
                f"{API_BASE}/workflow/status/display",
                params={"tenant_id": tenant_id, "agent_id": agent_id},
                headers=headers,
            )
            if status_response.status_code != 200:
                logger.error(f"Status display failed: {status_response.text}")
                return

            logger.info("All workflow steps completed successfully!")
            logger.info(
                "Final status: %s", json.dumps(status_response.json(), indent=2)
            )

        except Exception as e:
            logger.error(f"Workflow test failed: {str(e)}")


if __name__ == "__main__":
    asyncio.run(test_workflow())
