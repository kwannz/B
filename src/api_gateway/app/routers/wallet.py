from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any
from pydantic import BaseModel
from ..core.auth import User, get_current_active_user
from ..core.config import settings
import httpx

router = APIRouter(prefix="/wallet", tags=["wallet"])

class WalletCreate(BaseModel):
    """Request to create a new wallet."""
    name: str
    description: str = ""

class WalletConfirm(BaseModel):
    """Request to confirm wallet key management."""
    wallet_address: str
    confirmed: bool

@router.post("/create")
async def create_wallet(
    request: WalletCreate,
    current_user: User = Depends(get_current_active_user)
) -> Dict[str, Any]:
    """Create a new Solana wallet."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.TRADING_SERVICE_URL}/wallet/create",
                json=request.dict(),
                headers={"User": current_user.username}
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Trading service error: {str(e)}"
        )

@router.post("/confirm")
async def confirm_wallet(
    request: WalletConfirm,
    current_user: User = Depends(get_current_active_user)
) -> Dict[str, str]:
    """Confirm wallet key management."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.TRADING_SERVICE_URL}/wallet/confirm",
                json=request.dict(),
                headers={"User": current_user.username}
            )
            response.raise_for_status()
            return {"status": "confirmed", "wallet_address": request.wallet_address}
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Trading service error: {str(e)}"
        )

@router.get("/balance/{wallet_address}")
async def get_wallet_balance(
    wallet_address: str,
    current_user: User = Depends(get_current_active_user)
) -> Dict[str, Any]:
    """Get wallet balance."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{settings.TRADING_SERVICE_URL}/wallet/balance/{wallet_address}",
                headers={"User": current_user.username}
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Trading service error: {str(e)}"
        )

@router.get("/transactions/{wallet_address}")
async def get_wallet_transactions(
    wallet_address: str,
    current_user: User = Depends(get_current_active_user)
) -> Dict[str, Any]:
    """Get wallet transaction history."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{settings.TRADING_SERVICE_URL}/wallet/transactions/{wallet_address}",
                headers={"User": current_user.username}
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Trading service error: {str(e)}"
        )
