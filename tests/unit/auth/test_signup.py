import os
import pytest
from fastapi import HTTPException, Request
from unittest.mock import Mock, patch

from tradingbot.api_gateway.app.routes.auth.router import signup, SignupRequestExtended
from tradingbot.api_gateway.app.core.auth import Token
from tradingbot.api_gateway.app.models.user import User, UserCreate, UserRole

os.environ["TEST_MODE"] = "true"


@pytest.fixture(autouse=True)
def clear_users():
    """Clear stored users before each test."""
    User._test_users.clear()
    yield


@pytest.fixture
def mock_request():
    request = Mock(spec=Request)
    request.client.host = "127.0.0.1"
    request.headers = {"user-agent": "test-agent"}
    return request


@pytest.mark.asyncio
async def test_signup_success(mock_request):
    """Test successful user signup."""
    signup_data = SignupRequestExtended(
        email="test@example.com", username="testuser", password="Test123!@#"
    )

    response = await signup(mock_request, signup_data)
    assert isinstance(response, Token)
    assert response.token_type == "bearer"
    assert response.access_token is not None


@pytest.mark.asyncio
async def test_signup_existing_email(mock_request):
    """Test signup with existing email."""
    # First create a test user
    test_user_data = UserCreate(
        email="testuser@example.com",
        username="testuser",
        hashed_password="hashed_test_password",
        disabled=False,
        roles=[
            UserRole(
                name="backend_developer", permissions=["execute_market_maker_trades"]
            )
        ],
    )
    await User.create(test_user_data)

    # Try to create another user with same email
    signup_data = SignupRequestExtended(
        email="testuser@example.com",  # Email that exists in mock
        username="testuser",
        password="Test123!@#",
    )

    with pytest.raises(HTTPException) as exc_info:
        await signup(mock_request, signup_data)
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Email already registered"


@pytest.mark.asyncio
async def test_signup_invalid_password(mock_request):
    """Test signup with invalid password."""
    test_cases = [
        ("short", "Password must be at least 8 characters long"),
        ("lowercase123!", "Password must contain at least one uppercase letter"),
        ("UPPERCASE123!", "Password must contain at least one lowercase letter"),
        ("NoNumbers!", "Password must contain at least one number"),
        ("NoSpecial123", "Password must contain at least one special character"),
    ]

    for password, expected_error in test_cases:
        signup_data = SignupRequestExtended(
            email="test@example.com", username="testuser", password=password
        )

        with pytest.raises(HTTPException) as exc_info:
            await signup(mock_request, signup_data)
        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == expected_error


@pytest.mark.asyncio
async def test_signup_invalid_email(mock_request):
    """Test signup with invalid email format."""
    invalid_emails = [
        "notanemail",
        "missing@tld",
        "@nodomain.com",
        "spaces in@email.com",
    ]

    for email in invalid_emails:
        signup_data = SignupRequestExtended(
            email=email, username="testuser", password="Test123!@#"
        )

        with pytest.raises(HTTPException) as exc_info:
            await signup(mock_request, signup_data)
        assert exc_info.value.status_code == 400
        assert "Invalid email format" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_signup_role_assignment(mock_request):
    """Test that signup assigns correct role and permissions."""
    signup_data = SignupRequestExtended(
        email="new@example.com", username="newuser", password="Test123!@#"
    )

    response = await signup(mock_request, signup_data)
    assert isinstance(response, Token)

    # Verify the user was created with correct role
    user = await User.get_by_email("new@example.com")
    assert user is not None
    assert len(user.roles) == 1
    assert user.roles[0].name == "backend_developer"
    assert "execute_market_maker_trades" in user.roles[0].permissions
