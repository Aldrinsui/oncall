import os
from typing import List, Optional, Any
from pydantic import computed_field, model_validator, field_validator
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

    # Database Settings: Default to local SQLite via aiosqlite for standalone execution,
    # or override with PostgreSQL (postgresql+asyncpg://...)
    DATABASE_URL: Optional[str] = None
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "onground"

    # CORS Settings - Explicitly permits production Vercel frontend origin and preview deployments
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "https://oncall-ashy.vercel.app",
    ]
    CORS_ORIGIN_REGEX: Optional[str] = r"^https://oncall-[a-zA-Z0-9_-]+-aldrinsuis-projects\.vercel\.app$"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> Any:
        if isinstance(v, str):
            v_str = v.strip()
            if v_str.startswith("[") and v_str.endswith("]"):
                import json
                try:
                    return json.loads(v_str)
                except Exception:
                    pass
            return [origin.strip() for origin in v_str.split(",") if origin.strip()]
        return v

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

    # Telephony Provider Selection: 'twilio', 'plivo', or 'mock'
    TELEPHONY_PROVIDER: str = "twilio"
    PUBLIC_WEBHOOK_URL: str = "http://localhost:8000"

    # Twilio Configuration
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_API_KEY_SID: str = ""
    TWILIO_API_KEY_SECRET: str = ""
    TWILIO_CALLER_ID: str = ""
    TWILIO_AGENT_CALLER_ID: str = ""
    TWILIO_CUSTOMER_CALLER_ID: str = ""

    # Plivo Configuration
    PLIVO_AUTH_ID: str = ""
    PLIVO_AUTH_TOKEN: str = ""
    PLIVO_CALLER_ID: str = ""

    # Exotel Configuration
    EXOTEL_ACCOUNT_SID: str = ""
    EXOTEL_API_KEY: str = ""
    EXOTEL_API_TOKEN: str = ""
    EXOTEL_API_BASE_URL: str = "https://api.exotel.com"
    EXOTEL_CALLER_ID: str = ""

    # Webhook Shared Secret
    TELEPHONY_WEBHOOK_SECRET: str = "dev-telephony-secret-key"

    @model_validator(mode="after")
    def enforce_production_security(self) -> "Settings":
        # Disallow development auth bypass outside development/test
        if self.ENVIRONMENT.lower() == "production":
            self.DEV_AUTH_BYPASS_ENABLED = False

            # Require persistent hosted PostgreSQL database configuration in production
            if not self.DATABASE_URL:
                raise ValueError(
                    "Production backend requires a persistent database configuration (DATABASE_URL is not set). "
                    "Default local SQLite cannot be used in production. Please set DATABASE_URL to a remotely hosted "
                    "persistent PostgreSQL database (e.g. postgresql+asyncpg://user:pass@host:5432/dbname)."
                )
            db_url = self.DATABASE_URL.lower().strip()
            if db_url.startswith("sqlite"):
                raise ValueError(
                    f"Production backend cannot use SQLite ('{self.DATABASE_URL}'). "
                    "Production requires a remotely hosted persistent PostgreSQL database "
                    "(e.g. postgresql+asyncpg://user:pass@host:5432/dbname)."
                )

            is_postgres = (
                db_url.startswith("postgresql://")
                or db_url.startswith("postgresql+")
                or db_url.startswith("postgres://")
            )
            if not is_postgres:
                raise ValueError(
                    f"Production backend requires a remotely hosted persistent PostgreSQL database. "
                    f"Unsupported database scheme in '{self.DATABASE_URL}'. Please use postgresql+asyncpg://user:pass@host:5432/dbname."
                )

            if "localhost" in db_url or "127.0.0.1" in db_url or "[::1]" in db_url:
                raise ValueError(
                    f"Production backend database cannot point to localhost ('{self.DATABASE_URL}'). "
                    "Production requires a remotely hosted persistent PostgreSQL database service."
                )

            # In production, if using a real carrier provider, webhook URL must be public HTTPS
            if self.TELEPHONY_PROVIDER.lower() in ("twilio", "plivo", "exotel"):
                url = (self.PUBLIC_WEBHOOK_URL or "").strip().lower()
                if not url.startswith("https://") or "localhost" in url or "127.0.0.1" in url:
                    raise ValueError(
                        f"Production environment with telephony provider '{self.TELEPHONY_PROVIDER}' "
                        f"requires a publicly reachable HTTPS PUBLIC_WEBHOOK_URL. Got: '{self.PUBLIC_WEBHOOK_URL}'"
                    )

        # Reject incomplete API key pairs (do not silently fall back when only one is provided)
        has_key_sid = bool(self.TWILIO_API_KEY_SID and self.TWILIO_API_KEY_SID.strip())
        has_key_secret = bool(self.TWILIO_API_KEY_SECRET and self.TWILIO_API_KEY_SECRET.strip())
        if has_key_sid != has_key_secret:
            raise ValueError(
                "Incomplete Twilio API Key configuration: both TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET "
                "must be provided together. Cannot fall back to TWILIO_AUTH_TOKEN when partially configured."
            )

        # Reject incomplete Exotel credentials if partially set
        has_exotel_key = bool(self.EXOTEL_API_KEY and self.EXOTEL_API_KEY.strip())
        has_exotel_token = bool(self.EXOTEL_API_TOKEN and self.EXOTEL_API_TOKEN.strip())
        if has_exotel_key != has_exotel_token:
            raise ValueError(
                "Incomplete Exotel configuration: both EXOTEL_API_KEY and EXOTEL_API_TOKEN must be provided together."
            )

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
            if url.startswith("postgres://"):
                return url.replace("postgres://", "postgresql+asyncpg://", 1)
            return url
        return "sqlite+aiosqlite:///./oncall.db"

settings = Settings()
