from fastapi import APIRouter, HTTPException
from typing import Dict, List
from ..models.agent_models import AgentCreate, AgentUpdate, AgentResponse
from ...trading_agent.services.agent_manager import AgentManager

router = APIRouter()
agent_manager = AgentManager()

@router.post("/agents", response_model=AgentResponse)
async def create_agent(agent: AgentCreate):
    """创建新的交易代理"""
    try:
        new_agent = await agent_manager.create_agent(
            agent_id=agent.agent_id,
            name=agent.name,
            config=agent.config.dict()
        )
        return new_agent.get_status()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/agents", response_model=List[AgentResponse])
async def list_agents():
    """获取所有代理的状态"""
    return agent_manager.get_all_agents()

@router.get("/agents/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: str):
    """获取特定代理的状态"""
    agent = await agent_manager.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent.get_status()

@router.put("/agents/{agent_id}", response_model=AgentResponse)
async def update_agent(agent_id: str, agent_update: AgentUpdate):
    """更新代理配置"""
    updated_agent = await agent_manager.update_agent(
        agent_id=agent_id,
        config=agent_update.config.dict()
    )
    if not updated_agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return updated_agent.get_status()

@router.delete("/agents/{agent_id}")
async def delete_agent(agent_id: str):
    """删除代理"""
    success = await agent_manager.delete_agent(agent_id)
    if not success:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"message": "Agent deleted successfully"}

@router.post("/agents/{agent_id}/start")
async def start_agent(agent_id: str):
    """启动代理"""
    success = await agent_manager.start_agent(agent_id)
    if not success:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"message": "Agent started successfully"}

@router.post("/agents/{agent_id}/stop")
async def stop_agent(agent_id: str):
    """停止代理"""
    success = await agent_manager.stop_agent(agent_id)
    if not success:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"message": "Agent stopped successfully"}
