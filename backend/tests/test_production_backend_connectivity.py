import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.core.config import Settings
from backend.app.core.database import Base, get_db
from backend.tests.conftest import (
    test_async_engine,
    override_get_db,
)

@pytest.fixture(autouse=True)
async def setup_test_db():
    app.dependency_overrides[get_db] = override_get_db
    async with test_async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    app.dependency_overrides.pop(get_db, None)

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

@pytest.mark.asyncio
async def test_health_endpoint_root(client):
    """Verify backend exposes root /health with 200 and healthy status."""
    res = await client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "project" in data
    assert "version" in data
    assert "telephony_provider" in data

@pytest.mark.asyncio
async def test_health_endpoint_api_v1(client):
    """Verify backend exposes /api/v1/health with 200 and healthy status."""
    res = await client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"

@pytest.mark.asyncio
async def test_calls_endpoint_mounted(client):
    """Verify backend exposes /api/v1/calls route."""
    # GET /api/v1/calls should return 200 with list
    res = await client.get("/api/v1/calls")
    assert res.status_code == 200
    assert "data" in res.json()

@pytest.mark.asyncio
async def test_cors_production_vercel_origin(client):
    """Verify CORS explicitly permits the production Vercel frontend origin."""
    headers = {
        "Origin": "https://oncall-ashy.vercel.app",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type,Authorization",
    }
    res = await client.options("/api/v1/calls", headers=headers)
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") == "https://oncall-ashy.vercel.app"
    assert "POST" in res.headers.get("access-control-allow-methods", "")

@pytest.mark.asyncio
async def test_cors_vercel_preview_deployments(client):
    """Verify CORS permits dynamic Vercel preview branch deployments via regex."""
    headers = {
        "Origin": "https://oncall-git-feat-branch.vercel.app",
        "Access-Control-Request-Method": "GET",
    }
    res = await client.options("/api/v1/calls", headers=headers)
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") == "https://oncall-git-feat-branch.vercel.app"

@pytest.mark.asyncio
async def test_cors_rejects_unauthorized_origin(client):
    """Verify CORS does not allow arbitrary unauthorized origins."""
    headers = {
        "Origin": "https://unauthorized-attacker-site.com",
        "Access-Control-Request-Method": "POST",
    }
    res = await client.options("/api/v1/calls", headers=headers)
    assert res.headers.get("access-control-allow-origin") != "https://unauthorized-attacker-site.com"

def test_production_database_validation_missing():
    """Verify production settings reject missing DATABASE_URL."""
    with pytest.raises(ValueError, match="persistent database configuration"):
        Settings(
            ENVIRONMENT="production",
            DATABASE_URL=None,
            PUBLIC_WEBHOOK_URL="https://api.example.com",
            TELEPHONY_PROVIDER="mock",
        )

def test_production_database_validation_relative_sqlite():
    """Verify production settings reject relative SQLite database."""
    with pytest.raises(ValueError, match="relative or ephemeral SQLite database"):
        Settings(
            ENVIRONMENT="production",
            DATABASE_URL="sqlite+aiosqlite:///./oncall.db",
            PUBLIC_WEBHOOK_URL="https://api.example.com",
            TELEPHONY_PROVIDER="mock",
        )

def test_production_database_validation_localhost():
    """Verify production settings reject database pointing to localhost."""
    with pytest.raises(ValueError, match="cannot point to localhost"):
        Settings(
            ENVIRONMENT="production",
            DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/onground",
            PUBLIC_WEBHOOK_URL="https://api.example.com",
            TELEPHONY_PROVIDER="mock",
        )

def test_production_database_valid_persistent():
    """Verify production settings accept valid remote managed database."""
    s = Settings(
        ENVIRONMENT="production",
        DATABASE_URL="postgresql+asyncpg://user:secret@db.cloud-cluster.internal:5432/prod_db",
        PUBLIC_WEBHOOK_URL="https://api.example.com",
        TELEPHONY_PROVIDER="mock",
    )
    assert s.async_database_url == "postgresql+asyncpg://user:secret@db.cloud-cluster.internal:5432/prod_db"

def test_cors_origins_comma_separated_parsing():
    """Verify CORS_ORIGINS parses comma-separated strings."""
    s = Settings(
        CORS_ORIGINS="https://custom1.com, https://custom2.com",
        TELEPHONY_PROVIDER="mock",
    )
    assert "https://custom1.com" in s.CORS_ORIGINS
    assert "https://custom2.com" in s.CORS_ORIGINS
