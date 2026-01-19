"""
Main FastAPI application - API only.
Frontend is served as static files by Nginx.
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.backend.core.config import settings
from app.backend.api.routes import router
from app.backend.api.websocket import websocket_router
from app.backend.api.draft_routes import router as draft_router
from app.backend.api.auth_routes import router as auth_router
from app.backend.services.pricing_service import load_pricing_data
from app.backend.core.schema import create_tables


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Create database tables if they don't exist
    try:
        create_tables()
    except Exception as e:
        print(f"Warning: Could not create database tables: {e}")

    # Load pricing data into memory at startup
    load_pricing_data()
    yield


app = FastAPI(
    title=settings.app_name,
    description="Magic The Gathering Online Platform - API",
    version="0.1.0",
    lifespan=lifespan,
)

# Mount static files (for development; in production Nginx serves these)
static_dir = Path(__file__).resolve().parent.parent / "static"
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# Include API routers
app.include_router(router)
app.include_router(websocket_router)
app.include_router(draft_router)
app.include_router(auth_router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "app": settings.app_name}
