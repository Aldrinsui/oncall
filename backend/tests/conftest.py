import os
import tempfile
from typing import AsyncGenerator
import pytest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from backend.app.core.database import Base, async_engine, get_db
import backend.app.models  # Ensure all model tables are registered in Base.metadata

# Create isolated test database path strictly inside the OS temporary directory
TEST_DB_FILE = os.path.join(tempfile.gettempdir(), f"oncall_test_{os.getpid()}.db")
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"

# Defense-in-depth safety assertion: Ensure test engine NEVER targets development/production database
assert str(TEST_DATABASE_URL) != str(async_engine.url), (
    f"CRITICAL SAFETY VIOLATION: Test database URL matches application database URL: {async_engine.url}"
)

# Dedicated isolated test database engine
test_async_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)

# Dedicated isolated test session factory
TestAsyncSessionLocal = async_sessionmaker(
    bind=test_async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency override providing isolated test database sessions for FastAPI routes."""
    async with TestAsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

@pytest.fixture(scope="session", autouse=True)
def cleanup_test_db_file():
    """Remove temporary SQLite test database file upon test session completion."""
    yield
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass
