from decimal import Decimal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..services.solana_swap import solana_swap_service

router = APIRouter()

class SwapQuoteRequest(BaseModel):
    input_mint: str
    output_mint: str
    amount: Decimal
    slippage_bps: int = 50

class SwapExecuteRequest(BaseModel):
    quote_data: dict

@router.post("/quote")
async def get_swap_quote(request: SwapQuoteRequest):
    result = await solana_swap_service.get_swap_quote(
        input_mint=request.input_mint,
        output_mint=request.output_mint,
        amount=request.amount,
        slippage_bps=request.slippage_bps
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result["data"]

@router.post("/execute")
async def execute_swap(request: SwapExecuteRequest):
    result = await solana_swap_service.execute_swap({"data": request.quote_data})
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return {
        "transaction_id": result["transaction_id"],
        "status": result["status"],
        "data": result["data"]
    }
