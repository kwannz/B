import asyncio
import httpx
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


async def test_agent_selection():
    """Test just the agent selection endpoint."""
    async with httpx.AsyncClient() as client:
        try:
            # Register test user first
            register_data = {
                "email": "test@example.com",
                "password": "testpassword123",
                "username": "testuser",
                "tenant_id": "default",
                "is_tenant_admin": True,
            }
            register_response = await client.post(
                "http://localhost:8000/api/v1/auth/register",
                json=register_data,
                timeout=30.0,
            )
            logger.info(f"Registration response: {register_response.status_code}")
            logger.info(f"Registration body: {register_response.text}")

            if register_response.status_code != 200:
                logger.error("Registration failed")
                return

            auth_token = register_response.json()["access_token"]
            tenant_id = register_response.json()["tenant_id"]
            headers = {"Authorization": f"Bearer {auth_token}"}

            # Test agent selection
            agent_response = await client.get(
                "http://localhost:8000/api/v1/workflow/select_agent",
                params={"tenant_id": tenant_id},
                headers=headers,
                timeout=30.0,
            )
            logger.info(f"Agent selection response: {agent_response.status_code}")
            logger.info(f"Agent selection body: {agent_response.text}")

        except Exception as e:
            logger.error(f"Test failed: {str(e)}", exc_info=True)


if __name__ == "__main__":
    asyncio.run(test_agent_selection())
