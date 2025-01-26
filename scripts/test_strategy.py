import requests
import json

def test_strategy_creation():
    # First authenticate
    # First create a test user using OAuth2 form data format
    signup_response = requests.post(
        'http://localhost:8000/api/v1/auth/signup',
        data={
            'email': 'test@example.com',
            'username': 'testuser',
            'password': 'TestPass123!'
        })
    
    print("Signup Response:", signup_response.status_code)
    print("Signup Body:", signup_response.text)
    
    if signup_response.status_code != 200:
        print("Signup failed:", signup_response.text)
        return
        
    # Then login using OAuth2 password flow
    auth_response = requests.post(
        'http://localhost:8000/api/v1/auth/login',
        data={
            'grant_type': 'password',
            'username': 'testuser',
            'password': 'TestPass123!'
        })
    
    if auth_response.status_code != 200:
        print("Authentication failed:", auth_response.text)
        return
    
    token = auth_response.json()['access_token']
    
    # Test strategy creation
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    strategy_data = {
        "name": "Test Strategy",
        "promotion_words": "test strategy",
        "trading_pair": "SOL/USDT",
        "timeframe": "1h",
        "risk_level": "medium",
        "description": "Test strategy description"
    }
    
    response = requests.post(
        'http://localhost:8000/api/v1/strategies/trading/create',
        headers=headers,
        json=strategy_data
    )
    
    print("Response Status:", response.status_code)
    print("Response Body:", json.dumps(response.json(), indent=2))

if __name__ == "__main__":
    test_strategy_creation()
