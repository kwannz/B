"""
Risk management API endpoints
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..core.deps import get_current_user, get_database
from ..models.risk import RiskAssessment, RiskLimit, RiskProfile
from ..models.user import User

router = APIRouter()

@router.get("/limits", response_model=List[RiskLimit])
async def get_risk_limits(
    user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get all risk limits for the current user."""
    cursor = db.risk_limits.find({"user_id": user.id})
    limits = await cursor.to_list(length=100)
    return [RiskLimit(**limit) for limit in limits]

@router.post("/limits", response_model=RiskLimit, status_code=status.HTTP_201_CREATED)
async def create_risk_limit(
    limit: RiskLimit,
    user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Create a new risk limit."""
    limit.user_id = user.id
    result = await db.risk_limits.insert_one(limit.model_dump())
    created_limit = await db.risk_limits.find_one({"_id": result.inserted_id})
    return RiskLimit(**created_limit)

@router.get("/profile", response_model=RiskProfile)
async def get_risk_profile(
    user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get risk profile for the current user."""
    profile = await db.risk_profiles.find_one({"user_id": user.id})
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Risk profile not found"
        )
    return RiskProfile(**profile)

@router.post("/profile", response_model=RiskProfile)
async def create_or_update_risk_profile(
    profile: RiskProfile,
    user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Create or update risk profile."""
    profile.user_id = user.id
    profile.updated_at = datetime.utcnow()
    
    result = await db.risk_profiles.update_one(
        {"user_id": user.id},
        {"$set": profile.model_dump()},
        upsert=True
    )
    
    updated_profile = await db.risk_profiles.find_one({"user_id": user.id})
    return RiskProfile(**updated_profile)

@router.get("/assessment", response_model=RiskAssessment)
async def get_risk_assessment(
    user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get latest risk assessment for the current user."""
    assessment = await db.risk_assessments.find_one(
        {"user_id": user.id},
        sort=[("created_at", -1)]
    )
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Risk assessment not found"
        )
    return RiskAssessment(**assessment)

@router.post("/assessment", response_model=RiskAssessment)
async def create_risk_assessment(
    assessment: RiskAssessment,
    user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Create a new risk assessment."""
    assessment.user_id = user.id
    result = await db.risk_assessments.insert_one(assessment.model_dump())
    created_assessment = await db.risk_assessments.find_one({"_id": result.inserted_id})
    return RiskAssessment(**created_assessment)
