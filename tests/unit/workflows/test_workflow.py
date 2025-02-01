"""Test script for workflow endpoints."""

import requests
import json
import sys
from typing import Dict, Any

BASE_URL = "http://localhost:8000/api/v1"


def register_and_login() -> str:
    """Register a test user and get auth token."""
    try:
        # Register user
        register_data = {
            "email": "test@example.com",
            "password": "Test123!@#",
            "username": "testuser",
            "tenant_id": "default",
        }
        print("\nAttempting registration...")
        response = requests.post(f"{BASE_URL}/auth/register", json=register_data)
        print(f"Registration Status: {response.status_code}")
        print(f"Registration Response: {response.text}")

        if response.status_code == 409:  # User already exists
            print("User already exists, proceeding to login...")
        elif response.status_code != 200:
            print("Registration failed, but attempting login anyway...")
        else:
            print("Registration successful")

        # Login
        print("\nAttempting login...")
        login_data = {
            "username": "test@example.com",  # API expects email in username field
            "password": "Test123!@#",
            "grant_type": "password",
        }
        response = requests.post(
            f"{BASE_URL}/auth/token",
            data=login_data,  # Use form data instead of JSON
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        print(f"Login Status: {response.status_code}")
        print(f"Login Response: {response.text}")

        if response.status_code != 200:
            print("Login failed")
            return ""

        token = response.json().get("access_token", "")
        if token:
            print("Login successful")
            return token
        else:
            print("No token received")
            return ""

    except Exception as e:
        print(f"Error during authentication: {str(e)}")
        return ""


def test_workflow(token: str):
    """Test all workflow endpoints."""
    headers = {"Authorization": f"Bearer {token}"}

    # Step 1: Agent Selection
    print("\nTesting Agent Selection...")
    response = requests.get(
        f"{BASE_URL}/workflow/select_agent",
        params={"tenant_id": "default"},
        headers=headers,
    )
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2) if response.ok else response.text)

    # Step 2: Strategy Creation
    print("\nTesting Strategy Creation...")
    strategy_data = {
        "tenant_id": "default",
        "agent_id": "test_agent",
        "strategy_type": "momentum",
        "parameters": {"timeframe": "1h", "threshold": 0.02},
    }
    response = requests.post(
        f"{BASE_URL}/workflow/strategy/create", json=strategy_data, headers=headers
    )
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2) if response.ok else response.text)

    # Step 3: Bot Integration
    print("\nTesting Bot Integration...")
    bot_data = {
        "tenant_id": "default",
        "agent_id": "test_agent",
        "bot_type": "momentum",
        "config": {"entry_threshold": 0.02, "exit_threshold": 0.01, "stop_loss": 0.05},
    }
    response = requests.post(
        f"{BASE_URL}/workflow/bot/integrate", json=bot_data, headers=headers
    )
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2) if response.ok else response.text)

    # Step 4: Wallet Creation
    print("\nTesting Wallet Creation...")
    wallet_data = {
        "tenant_id": "default",
        "agent_id": "test_agent",
        "wallet_type": "trading",
        "config": {"daily_limit": 1000, "risk_level": "medium"},
    }
    response = requests.post(
        f"{BASE_URL}/workflow/wallet/create", json=wallet_data, headers=headers
    )
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2) if response.ok else response.text)

    # Step 5: Key Management
    print("\nTesting Key Management...")
    key_data = {
        "tenant_id": "default",
        "agent_id": "test_agent",
        "keys": {"api_key": "test_key", "api_secret": "test_secret"},
    }
    response = requests.post(
        f"{BASE_URL}/workflow/key/manage", json=key_data, headers=headers
    )
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2) if response.ok else response.text)

    # Step 6: Status Display
    print("\nTesting Status Display...")
    response = requests.get(
        f"{BASE_URL}/workflow/status/display",
        params={"tenant_id": "default", "agent_id": "test_agent"},
        headers=headers,
    )
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2) if response.ok else response.text)


if __name__ == "__main__":
    token = register_and_login()
    if token:
        test_workflow(token)
    else:
        print("Failed to get authentication token")
