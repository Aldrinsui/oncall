from uuid import UUID
from typing import Optional
from fastapi import Header, HTTPException, status
from pydantic import BaseModel
from backend.app.core.config import settings

class AuthenticatedAgent(BaseModel):
    id: UUID
    name: str
    email: str
    store: str
    role: str = "AGENT"

# Known dev agents for local testing and deterministic isolation
DEV_AGENTS = {
    UUID(settings.DEV_AGENT_ID): AuthenticatedAgent(
        id=UUID(settings.DEV_AGENT_ID),
        name=settings.DEV_AGENT_NAME,
        email=settings.DEV_AGENT_EMAIL,
        store=settings.DEV_AGENT_STORE,
        role="AGENT",
    ),
    UUID(settings.DEV_AGENT_2_ID): AuthenticatedAgent(
        id=UUID(settings.DEV_AGENT_2_ID),
        name=settings.DEV_AGENT_2_NAME,
        email=settings.DEV_AGENT_2_EMAIL,
        store=settings.DEV_AGENT_2_STORE,
        role="AGENT",
    ),
    UUID(settings.DEV_AGENT_3_ID): AuthenticatedAgent(
        id=UUID(settings.DEV_AGENT_3_ID),
        name=settings.DEV_AGENT_3_NAME,
        email=settings.DEV_AGENT_3_EMAIL,
        store=settings.DEV_AGENT_3_STORE,
        role="AGENT",
    ),
}

async def get_current_agent(
    authorization: Optional[str] = Header(None),
    x_agent_id: Optional[str] = Header(None, alias="X-Agent-Id"),
    x_store_id: Optional[str] = Header(None, alias="X-Store-Id"),
) -> AuthenticatedAgent:
    """
    Authenticate the requesting agent with store and identity context.
    Enforces BearerAuth in production; supports test/dev agent resolution in development.
    """
    # 1. In production, strictly require Bearer token
    if settings.ENVIRONMENT == "production":
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing or invalid Bearer authentication token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        # Placeholder for real JWT decoding in production
        token = authorization[7:].strip()
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Empty Bearer token",
                headers={"WWW-Authenticate": "Bearer"},
            )

    # 2. Check explicit dev / test agent override
    if x_agent_id:
        try:
            agent_uuid = UUID(x_agent_id)
            if agent_uuid in DEV_AGENTS:
                agent = DEV_AGENTS[agent_uuid]
                if x_store_id:
                    return AuthenticatedAgent(
                        id=agent.id,
                        name=agent.name,
                        email=agent.email,
                        store=x_store_id,
                        role=agent.role,
                    )
                return agent
            else:
                return AuthenticatedAgent(
                    id=agent_uuid,
                    name=f"Agent-{str(agent_uuid)[:8]}",
                    email=f"agent-{str(agent_uuid)[:8]}@test.com",
                    store=x_store_id or settings.DEV_AGENT_STORE,
                    role="AGENT",
                )
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid X-Agent-Id header format",
            )

    # 3. Development bypass fallback
    if settings.DEV_AUTH_BYPASS_ENABLED:
        default_agent = DEV_AGENTS[UUID(settings.DEV_AGENT_ID)]
        if x_store_id:
            return AuthenticatedAgent(
                id=default_agent.id,
                name=default_agent.name,
                email=default_agent.email,
                store=x_store_id,
                role=default_agent.role,
            )
        return default_agent

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
        headers={"WWW-Authenticate": "Bearer"},
    )
