import requests
import json
import time
from typing import Dict, Any
from datetime import datetime

BASE_URL = "http://localhost:8000/api/v1"

def log_step(step: str, response: requests.Response) -> None:
    """Log API response details with proper formatting"""
    print(f"\n{'='*20} {step} {'='*20}")
    print(f"Status Code: {response.status_code}")
    try:
        print(f"Response: {json.dumps(response.json(), indent=2)}")
    except:
        print(f"Raw Response: {response.text}")
    print('='*50)

def test_workflow():
    """Test the complete 6-step trading bot workflow"""
    results = {
        "Authentication": False,
        "Agent Selection": False,
        "Strategy Creation": False,
        "Bot Integration": False,
        "Wallet Management": False,
        "Dashboard": False
    }
    
    print("\n=== Starting Trading Bot Workflow Test ===")
    start_time = datetime.now()
    
    # Step 1: Test Authentication
    print("\nStep 1: Testing Authentication...")
    
    try:
        # Step 1: Authentication
        auth_response = requests.post(
            f"{BASE_URL}/auth/signup",
            data={
                "email": "test@example.com",
                "username": "testuser",
                "password": "TestPass123!"
            }
        )
        log_step("Authentication", auth_response)
        results["Authentication"] = auth_response.status_code == 200

        if results["Authentication"]:
            token = auth_response.json()["access_token"]
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }

            # Step 2: Agent Selection
            print("\nStep 2: Testing Agent Selection...")
            agent_response = requests.get(
                f"{BASE_URL}/agents/trading/status",
                headers=headers
            )
            log_step("Agent Selection", agent_response)
            results["Agent Selection"] = agent_response.status_code == 200

            # Step 3: Strategy Creation
            print("\nStep 3: Testing Strategy Creation...")
            strategy_data = {
                "name": "Test Strategy",
                "promotion_words": "test strategy",
                "trading_pair": "SOL/USDT",
                "timeframe": "1h",
                "risk_level": "medium",
                "description": "Test strategy description"
            }
            strategy_response = requests.post(
                f"{BASE_URL}/strategies/trading/create",
                json=strategy_data,
                headers=headers
            )
            log_step("Strategy Creation", strategy_response)
            results["Strategy Creation"] = strategy_response.status_code == 200

            if results["Strategy Creation"]:
                # Step 4: Bot Integration
                print("\nStep 4: Testing Bot Integration...")
                bot_response = requests.post(
                    f"{BASE_URL}/agents/trading/start",
                    headers=headers
                )
                log_step("Bot Integration", bot_response)
                results["Bot Integration"] = bot_response.status_code == 200

                # Step 5: Wallet Management
                print("\nStep 5: Testing Wallet Management...")
                wallet_address = "Bmy8pkxSMLHTdaCop7urr7b4FPqs3QojVsGuC9Ly4vsU"
                wallet_response = requests.get(
                    f"{BASE_URL}/wallet/balance/{wallet_address}",
                    headers=headers
                )
                log_step("Wallet Management", wallet_response)
                results["Wallet Management"] = wallet_response.status_code == 200

                # Step 6: Dashboard Data
                print("\nStep 6: Testing Dashboard Data...")
                dashboard_response = requests.get(
                    f"{BASE_URL}/wallet/transactions/{wallet_address}",
                    headers=headers
                )
                log_step("Dashboard Data", dashboard_response)
                results["Dashboard"] = dashboard_response.status_code == 200

    except Exception as e:
        print(f"\nError during workflow test: {str(e)}")

    # Print Summary
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()

    print("\n=== Workflow Test Summary ===")
    print(f"Test Duration: {duration:.2f} seconds")
    print("\nTest Results:")
    for step, success in results.items():
        status = "✓" if success else "✗"
        print(f"{step:20} {status}")
    
    # Return overall success status
    return all(results.values())

if __name__ == "__main__":
    test_workflow()
