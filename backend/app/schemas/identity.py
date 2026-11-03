from uuid import UUID
from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from backend.app.domains.common.enums import UserRole
from backend.app.schemas.common import MetaEnvelope

class AgentDTO(BaseModel):
    id: UUID
    user_id: UUID
    email: EmailStr
    full_name: str
    role: UserRole = UserRole.AGENT
    initials: str
    emoji: str = "🦸‍♂️"
    store: str
    brand: str
    phone_e164: Optional[str] = None
    endpoint_type: str = "WEBRTC_MOCK"
    endpoint_uri: str = "webrtc:agent-dev"
    og_score: int = Field(default=0, ge=0, le=100)
    rank: int = 1

class AgentResponse(BaseModel):
    data: AgentDTO
    meta: MetaEnvelope

class UpdateEndpointRequest(BaseModel):
    endpoint_type: str
    endpoint_uri: str
    phone_e164: Optional[str] = Field(default=None, pattern=r"^\+[1-9]\d{1,14}$")
