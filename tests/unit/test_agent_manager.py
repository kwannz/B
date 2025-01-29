import pytest
import pytest_asyncio
from src.backend.trading_agent.services.agent_manager import AgentManager

@pytest_asyncio.fixture
async def agent_manager():
    return AgentManager()

@pytest.mark.asyncio
async def test_create_specialized_agents(agent_manager):
    agent_types = [
        "market_data", "valuation", "sentiment", "fundamentals",
        "technical", "risk", "portfolio"
    ]
    
    for agent_type in agent_types:
        agent = await agent_manager.create_specialized_agent(
            agent_type=agent_type,
            agent_id=f"test_{agent_type}",
            name=f"Test {agent_type.title()} Agent",
            config={"test": True}
        )
        assert agent.agent_id == f"test_{agent_type}"
        assert agent.name == f"Test {agent_type.title()} Agent"
        assert agent.status == "inactive"

@pytest.mark.asyncio
async def test_agent_lifecycle(agent_manager):
    agent = await agent_manager.create_specialized_agent(
        agent_type="market_data",
        agent_id="test_lifecycle",
        name="Test Lifecycle",
        config={"test": True}
    )
    
    assert agent.status == "inactive"
    await agent_manager.start_agent("test_lifecycle")
    assert agent.status == "active"
    await agent_manager.stop_agent("test_lifecycle")
    assert agent.status == "inactive"

@pytest.mark.asyncio
async def test_invalid_agent_type(agent_manager):
    with pytest.raises(ValueError, match="Unknown agent type"):
        await agent_manager.create_specialized_agent(
            agent_type="invalid",
            agent_id="test_invalid",
            name="Test Invalid",
            config={}
        )
