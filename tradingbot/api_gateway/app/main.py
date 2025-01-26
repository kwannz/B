"""API Gateway application package."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from .routes import router as api_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Trading Bot API Gateway",
    description="API Gateway for the Trading Bot platform",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router with version prefix
app.include_router(
    api_router,
    prefix="/api/v1",
)

@app.on_event("startup")
async def startup_event():
    """Execute startup tasks."""
    logger.info("API Gateway starting up...")
    logger.info("Routes configured with prefix: /api/v1")

@app.on_event("shutdown")
async def shutdown_event():
    """Execute shutdown tasks."""
    logger.info("API Gateway shutting down...")
