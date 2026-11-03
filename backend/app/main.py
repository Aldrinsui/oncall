from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.core.config import settings
from backend.app.core.database import async_engine, Base
from backend.app.api.routes.calls import router as calls_router, webhook_router

import logging

logger = logging.getLogger("uvicorn.error")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables exist on startup
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Validate provider and webhook URL configuration
    provider = settings.TELEPHONY_PROVIDER.lower().strip()
    if provider in ("twilio", "plivo"):
        url = settings.PUBLIC_WEBHOOK_URL.lower().strip()
        if not url.startswith("https://") or "localhost" in url or "127.0.0.1" in url:
            if settings.ENVIRONMENT == "production":
                raise ValueError(
                    f"Production startup failed: Provider '{provider}' requires a publicly reachable HTTPS "
                    f"PUBLIC_WEBHOOK_URL. Configured: '{settings.PUBLIC_WEBHOOK_URL}'"
                )
            else:
                logger.warning(
                    f"[TELEPHONY CONFIG WARNING] Running with live provider '{provider}' but PUBLIC_WEBHOOK_URL "
                    f"is '{settings.PUBLIC_WEBHOOK_URL}'. Real carriers cannot reach localhost callbacks. "
                    f"Ensure an HTTPS tunnel (e.g. ngrok) is configured before live carrier testing."
                )

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
app.include_router(calls_router, prefix=settings.API_V1_STR)
app.include_router(webhook_router, prefix=settings.API_V1_STR)

@app.get("/health", tags=["System"])
@app.get(f"{settings.API_V1_STR}/health", tags=["System"])
async def health_check():
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "telephony_provider": settings.TELEPHONY_PROVIDER,
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
