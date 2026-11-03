from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.core.config import settings
from backend.app.core.database import async_engine, Base, AsyncSessionLocal
from backend.app.models import (
    PulseChannelModel,
    PulseMessageModel,
    PulseMessageReadModel,
    PulsePinnedItemModel,
    PulsePinnedResponseModel,
    AgentMetricModel,
    TaskModel,
)
from backend.app.api.routes.pulse import router as pulse_router
from backend.app.api.routes.tasks import router as tasks_router
from backend.app.services.pulse_service import PulseService

import logging

logger = logging.getLogger("uvicorn.error")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables exist on startup
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed initial Pulse data, channels, metrics, and tasks
    async with AsyncSessionLocal() as session:
        await PulseService.seed_data_if_empty(session)

    yield
    # Shutdown
    await async_engine.dispose()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routes
app.include_router(pulse_router, prefix=settings.API_V1_STR)
app.include_router(tasks_router, prefix=settings.API_V1_STR)

@app.get("/health", tags=["System"])
@app.get(f"{settings.API_V1_STR}/health", tags=["System"])
async def health_check():
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
    }

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": str(exc) if settings.ENVIRONMENT != "production" else "An unexpected error occurred.",
            }
        },
    )
