import asyncio
import importlib
import pytest
import sys
from datetime import datetime, timedelta
from fastapi import HTTPException, Request
from jose import jwt
from unittest.mock import Mock, patch, MagicMock

from tradingbot.api_gateway.app.core.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user,
    get_current_active_user,
    extract_request_context,
    Token,
    TokenData,
)
from tradingbot.api_gateway.app.core.config import settings

@pytest.fixture
def mock_request():
    request = Mock(spec=Request)
    request.client.host = "127.0.0.1"
    request.headers = {"user-agent": "test-agent"}
    return request

@pytest.fixture
def mock_request_no_client():
    request = Mock(spec=Request)
    request.client = None
    request.headers = {"user-agent": "test-agent"}
    return request

@pytest.fixture
def mock_request_no_user_agent():
    request = Mock(spec=Request)
    request.client.host = "127.0.0.1"
    request.headers = {}
    return request

def test_password_hashing():
    """Test password hashing and verification."""
    password = "testpassword123"
    hashed = get_password_hash(password)
    
    # Verify the hash is different from the original password
    assert hashed != password
    
    # Verify correct password
    assert verify_password(password, hashed) is True
    
    # Verify incorrect password
    assert verify_password("wrongpassword", hashed) is False
    
    # Test empty password
    empty_hash = get_password_hash("")
    assert verify_password("", empty_hash) is True
    assert verify_password("something", empty_hash) is False

def test_create_access_token():
    """Test access token creation."""
    data = {"sub": "testuser"}
    
    # Test with explicit expiration
    expires = timedelta(minutes=30)
    token = create_access_token(data, expires)
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    assert payload["sub"] == "testuser"
    assert "exp" in payload
    
    # Test with default expiration
    token = create_access_token(data)
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    assert payload["sub"] == "testuser"
    assert "exp" in payload
    
    # Test with empty data
    empty_token = create_access_token({})
    empty_payload = jwt.decode(empty_token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    assert "exp" in empty_payload
    assert "sub" not in empty_payload

@pytest.mark.asyncio
async def test_get_current_user():
    """Test current user retrieval from token."""
    # Ensure test mode is set and environment is initialized
    import os
    import importlib
    os.environ['TEST_MODE'] = 'true'
    
    # Force reload auth module to ensure test environment is set up
    from tradingbot.api_gateway.app.core import auth
    importlib.reload(auth)
    
    # Create test user
    from tests.unit.mocks import UserCreate, UserRole, UserStorage
    test_user = UserCreate(
        email="testuser@example.com",
        username="testuser",
        hashed_password="hashed_password",
        disabled=False,
        roles=[UserRole(
            name="backend_developer",
            permissions=["execute_market_maker_trades"]
        )]
    )
    UserStorage.clear_users()
    await UserStorage.create(test_user)
    
    # Test with valid token
    token = create_access_token({"sub": "testuser@example.com"})
    user = await get_current_user(token)
    assert user.username == "testuser"
    assert user.email == "testuser@example.com"
    assert user.disabled is False
    assert len(user.roles) == 1
    assert user.roles[0].name == "backend_developer"
    assert user.roles[0].permissions == ["execute_market_maker_trades"]
    
    # Test with invalid token
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user("invalid_token")
    assert exc_info.value.status_code == 401
    
    # Test with non-existent user
    non_existent_token = create_access_token({"sub": "nonexistent@example.com"})
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(non_existent_token)
    assert exc_info.value.status_code == 401
    
    # Test with invalid token
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user("invalid_token")
    assert exc_info.value.status_code == 401
    assert exc_info.value.headers["WWW-Authenticate"] == "Bearer"
    
    # Test with None token
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(None)
    assert exc_info.value.status_code == 401
    
    # Test with non-string token
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(123)
    assert exc_info.value.status_code == 401
    
    # Test with expired token
    expired_token = create_access_token(
        {"sub": "testuser"},
        expires_delta=timedelta(microseconds=1)
    )
    await asyncio.sleep(0.1)  # Ensure token expires
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(expired_token)
    assert exc_info.value.status_code == 401
    
    # Test with missing username
    invalid_token = create_access_token({})
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(invalid_token)
    assert exc_info.value.status_code == 401

    # Test user is None case
    valid_token = create_access_token({"sub": "testuser"})
    with patch('tests.unit.mocks.UserStorage.get_by_email', return_value=None):
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(valid_token)
        assert exc_info.value.status_code == 401

@pytest.mark.asyncio
async def test_get_current_active_user():
    """Test active user validation."""
    # Create mock users
    active_user = Mock(disabled=False, username="active")
    disabled_user = Mock(disabled=True, username="disabled")
    
    # Test with active user
    result = await get_current_active_user(active_user)
    assert result == active_user
    
    # Test with disabled user
    with pytest.raises(HTTPException) as exc_info:
        await get_current_active_user(disabled_user)
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Inactive user"

def test_extract_request_context(mock_request, mock_request_no_client, mock_request_no_user_agent):
    """Test request context extraction."""
    # Test with all fields present
    context = extract_request_context(mock_request)
    assert context["ip"] == "127.0.0.1"
    assert context["user_agent"] == "test-agent"
    assert isinstance(context["timestamp"], str)
    datetime.fromisoformat(context["timestamp"])
    
    # Test with no client
    context_no_client = extract_request_context(mock_request_no_client)
    assert context_no_client["ip"] is None
    assert context_no_client["user_agent"] == "test-agent"
    
    # Test with no user agent
    context_no_ua = extract_request_context(mock_request_no_user_agent)
    assert context_no_ua["ip"] == "127.0.0.1"
    assert context_no_ua["user_agent"] is None

def test_token_models():
    """Test token models."""
    # Test Token model
    token = Token(access_token="test_token", token_type="bearer")
    assert token.access_token == "test_token"
    assert token.token_type == "bearer"
    
    # Test TokenData model
    token_data = TokenData(username="testuser")
    assert token_data.username == "testuser"
    
    # Test TokenData with no username
    empty_token_data = TokenData()
    assert empty_token_data.username is None
    
    # Test Token model validation
    token_dict = token.dict()
    assert token_dict == {
        "access_token": "test_token",
        "token_type": "bearer"
    }
    
    # Test TokenData model validation
    token_data_dict = token_data.dict()
    assert token_data_dict == {
        "username": "testuser"
    }

@pytest.mark.asyncio
async def test_import_paths():
    """Test import paths for both test and non-test environments."""
    import os
    import importlib
    
    # Store original modules and environment
    original_modules = dict(sys.modules)
    original_test_mode = os.getenv('TEST_MODE')
    
    try:
        # Remove any existing imports
        for module in list(sys.modules.keys()):
            if module.startswith(('tradingbot', 'tests.unit.mocks', 'src.api_gateway')):
                del sys.modules[module]
        
        # Test environment
        os.environ['TEST_MODE'] = 'true'
        
        # Import the test module
        import tests.unit.mocks
        importlib.reload(tests.unit.mocks)
        
        # Import auth module and verify User class
        from tradingbot.api_gateway.app.core.auth import User as TestUser
        assert TestUser.__module__ == 'tests.unit.mocks'
        
        # Non-test environment
        os.environ['TEST_MODE'] = ''
        
        # Clear modules again
        for module in list(sys.modules.keys()):
            if module.startswith(('tradingbot', 'tests.unit.mocks', 'src.api_gateway')):
                del sys.modules[module]
                
        # Import should succeed but User should be from models.user
        from tradingbot.api_gateway.app.core.auth import User as ProdUser
        assert ProdUser.__module__ == 'tradingbot.api_gateway.app.models.user'
    finally:
        # Restore original state
        sys.modules.clear()
        sys.modules.update(original_modules)
        if original_test_mode is not None:
            os.environ['TEST_MODE'] = original_test_mode
        else:
            os.environ.pop('TEST_MODE', None)
