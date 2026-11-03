from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from backend.app.domains.common.enums import UserRole, AgentEndpointType
from backend.app.domains.common.validation import validate_e164

@dataclass(kw_only=True)
class User:
    id: UUID = field(default_factory=uuid4)
    email: str = ""
    full_name: str = ""
    role: UserRole = UserRole.AGENT
    is_active: bool = True
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self):
        if not self.email or "@" not in self.email:
            raise ValueError(f"Invalid email: {self.email}")
        if not self.full_name or not self.full_name.strip():
            raise ValueError("Full name cannot be empty")

@dataclass(kw_only=True)
class Agent:
    user_id: UUID
    id: UUID = field(default_factory=uuid4)
    initials: str = ""
    emoji: str = "🦸‍♂️"
    store: str = ""
    brand: str = ""
    phone_e164: Optional[str] = None
    endpoint_type: AgentEndpointType = AgentEndpointType.WEBRTC_MOCK
    endpoint_uri: str = "webrtc:agent-dev"
    og_score: int = 0
    rank: int = 1
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self):
        if not (0 <= self.og_score <= 100):
            raise ValueError(f"og_score must be between 0 and 100, got {self.og_score}")
        if self.phone_e164 is not None:
            validate_e164(self.phone_e164, "Agent phone_e164")
        if self.endpoint_type == AgentEndpointType.PSTN_PHONE:
            if not self.phone_e164:
                raise ValueError("PSTN_PHONE endpoint requires valid E.164 phone number")
            if self.endpoint_uri not in {self.phone_e164, f"tel:{self.phone_e164}"}:
                raise ValueError(
                    f"Agent endpoint_uri ({self.endpoint_uri}) must match phone_e164 ({self.phone_e164}) for PSTN_PHONE endpoint"
                )
