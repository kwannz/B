"""
Trading Bot API main application
"""

import logging
import time
from datetime import datetime

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_redoc_html, get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse

from .core.config import Settings
from .core.exceptions import TradingBotException
from .routers import monitoring, risk, trading

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Load settings
settings = Settings()

# Create FastAPI app
app = FastAPI(
    title="Trading Bot API",
    description="""
    AI-powered automated trading system API.
    
    Features:
    * AI-driven trading decisions
    * Real-time market analysis
    * High-frequency trading support
    * Advanced risk management
    * Performance monitoring
    * Multiple strategy support
    """,
    version="1.0.0",
    docs_url=None,  # Disable default docs
    redoc_url=None,  # Disable default redoc
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Add timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Add processing time to response headers"""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response


# Add error handling middleware
@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    """Global exception handler"""
    try:
        return await call_next(request)
    except TradingBotException as exc:
        logger.error(f"Trading bot error: {exc}")
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": exc.detail,
                "timestamp": datetime.utcnow().isoformat(),
                "path": request.url.path,
            },
        )
    except Exception as exc:
        logger.error(f"Unexpected error: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "error": "Internal server error",
                "timestamp": datetime.utcnow().isoformat(),
                "path": request.url.path,
            },
        )


# Include routers
app.include_router(trading.router, prefix="/api/v1/trading", tags=["trading"])
app.include_router(risk.router, prefix="/api/v1/risk", tags=["risk"])
app.include_router(monitoring.router, prefix="/api/v1/monitoring", tags=["monitoring"])


@app.get("/health")
async def health_check():
    """API health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": settings.VERSION,
    }


@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "name": "Trading Bot API",
        "version": settings.VERSION,
        "docs_url": "/docs",
        "redoc_url": "/redoc",
    }


@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    """Custom Swagger UI."""
    return get_swagger_ui_html(
        openapi_url="/openapi.json",
        title="Trading Bot API - Swagger UI",
        oauth2_redirect_url="/docs/oauth2-redirect",
        swagger_js_url="/static/swagger-ui-bundle.js",
        swagger_css_url="/static/swagger-ui.css",
    )


@app.get("/redoc", include_in_schema=False)
async def redoc_html():
    """ReDoc documentation."""
    return get_redoc_html(
        openapi_url="/openapi.json",
        title="Trading Bot API - ReDoc",
        redoc_js_url="/static/redoc.standalone.js",
    )


@app.get("/openapi.json", include_in_schema=False)
async def get_openapi_endpoint():
    """Generate OpenAPI schema."""
    return get_openapi(
        title="Trading Bot API",
        version="1.0.0",
        description="""
        AI-powered automated trading system API.
        
        Features:
        * AI-driven trading decisions
        * Real-time market analysis
        * High-frequency trading support
        * Advanced risk management
        * Performance monitoring
        * Multiple strategy support
        """,
        routes=app.routes,
    )
