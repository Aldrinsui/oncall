from typing import List, Optional
from pydantic import computed_field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    PROJECT_NAME: str = "OnGround.ai API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"  # development, test, staging, production

    # Database Settings: Default to local SQLite via aiosqlite for standalone execution
    DATABASE_URL: Optional[str] = None
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "onground"

    # CORS Settings
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    # Security & Development Identity
    DEV_AUTH_BYPASS_ENABLED: bool = True
    DEV_AGENT_ID: str = "00000000-0000-0000-0000-000000000001"
    DEV_AGENT_EMAIL: str = "arvind.rajan@sleepcompany.com"
    DEV_AGENT_NAME: str = "Arvind Rajan"
    DEV_AGENT_STORE: str = "Koramangala"
    DEV_AGENT_PHONE: Optional[str] = "+919000000001"

    # Secondary dev agent for cross-agent isolation testing
    DEV_AGENT_2_ID: str = "00000000-0000-0000-0000-000000000002"
    DEV_AGENT_2_EMAIL: str = "neha.p@sleepcompany.com"
    DEV_AGENT_2_NAME: str = "Neha P."
    DEV_AGENT_2_STORE: str = "Koramangala"

    # Third dev agent in different store for cross-store isolation testing
    DEV_AGENT_3_ID: str = "00000000-0000-0000-0000-000000000003"
    DEV_AGENT_3_EMAIL: str = "sameena.s@sleepcompany.com"
    DEV_AGENT_3_NAME: str = "Sameena S."
    DEV_AGENT_3_STORE: str = "RT Nagar"

    # Telephony Provider Selection
    TELEPHONY_PROVIDER: str = "mock"
    PUBLIC_WEBHOOK_URL: str = "http://localhost:8000"

    @model_validator(mode="after")
    def enforce_production_security(self) -> "Settings":
        if self.ENVIRONMENT.lower() == "production":
            self.DEV_AUTH_BYPASS_ENABLED = False
        return self

    @computed_field
    @property
    def async_database_url(self) -> str:
        if self.DATABASE_URL:
            url = self.DATABASE_URL
            if url.startswith("sqlite:///"):
                return url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
            if url.startswith("postgresql://"):
                return url.replace("postgresql://", "postgresql+asyncpg://", 1)
            if url.startswith("postgresql+psycopg2://"):
                return url.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)
            return url
        return "sqlite+aiosqlite:///./oncall.db"

settings = Settings()
