from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from auth.google import router as google_router
import os

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3001")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add Google OAuth routes
app.include_router(google_router, prefix="/api/auth", tags=["auth"])

@app.get("/")
async def root():
    return {"status": "ok"}
