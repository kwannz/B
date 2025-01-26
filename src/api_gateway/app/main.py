from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .routers import agents, strategies, trading, wallet, auth

app = FastAPI(title="Trading Bot API Gateway")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, set specific domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(agents.router, prefix="/api/v1/agents", tags=["agents"])
app.include_router(strategies.router, prefix="/api/v1/strategies", tags=["strategies"])
app.include_router(trading.router, prefix="/api/v1/trading", tags=["trading"])
app.include_router(wallet.router, prefix="/api/v1/wallet", tags=["wallet"])

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

@app.on_event("startup")
async def startup_event():
    """Initialize application dependencies"""
    # Initialize database connection and load configuration
    pass

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup application resources"""
    # Close database connection and stop all agents
    pass
