from uuid import UUID
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict, model_validator
from backend.app.domains.common.enums import UserRole, AgentEndpointType
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
    endpoint_type: AgentEndpointType = AgentEndpointType.WEBRTC_MOCK
    endpoint_uri: str = "webrtc:agent-dev"
    og_score: int = Field(default=0, ge=0, le=100)
    rank: int = 1

class AgentResponse(BaseModel):
    data: AgentDTO
    meta: MetaEnvelope

class UpdateEndpointRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    endpoint_type: AgentEndpointType
    endpoint_uri: str = Field(min_length=1, max_length=255)
    phone_e164: Optional[str] = Field(default=None, pattern=r"^\+[1-9]\d{1,14}$")

    @model_validator(mode="after")
    def validate_pstn_phone_required(self) -> "UpdateEndpointRequest":
        if self.endpoint_type == AgentEndpointType.PSTN_PHONE and not self.phone_e164:
            raise ValueError("phone_e164 is required when endpoint_type is PSTN_PHONE")
        return self
