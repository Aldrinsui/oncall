from datetime import datetime
from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict, model_validator
from backend.app.domains.common.enums import ParticipantStatus
from backend.app.schemas.common import MetaEnvelope

class CalendarParticipantDTO(BaseModel):
    id: UUID
    is_agent: bool = False
    agent_id: Optional[UUID] = None
    name: str = Field(min_length=1, max_length=255)
    role: str = Field(min_length=1, max_length=100)
    email_or_channel: str = Field(min_length=1, max_length=255)
    status: ParticipantStatus = ParticipantStatus.INVITED

    @model_validator(mode="after")
    def validate_agent_consistency(self) -> "CalendarParticipantDTO":
        if self.is_agent and not self.agent_id:
            raise ValueError("agent_id is required when is_agent is True")
        if not self.is_agent and self.agent_id is not None:
            raise ValueError("agent_id must be None when is_agent is False")
        return self

class CalendarEventDTO(BaseModel):
    id: UUID
    organizer_id: UUID
    title: str = Field(min_length=1, max_length=255)
    location: Optional[str] = Field(default=None, max_length=255)
    session_slug: str = Field(min_length=1, max_length=255)
    meta: Optional[str] = Field(default=None, max_length=500)
    starts_at: datetime
    ends_at: datetime
    is_all_day: bool = False
    participants: List[CalendarParticipantDTO] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_time_chronology(self) -> "CalendarEventDTO":
        if self.ends_at < self.starts_at:
            raise ValueError(f"ends_at ({self.ends_at}) cannot precede starts_at ({self.starts_at})")
        return self

class CalendarEventResponse(BaseModel):
    data: CalendarEventDTO
    meta: MetaEnvelope

class CalendarEventListResponse(BaseModel):
    data: List[CalendarEventDTO]
    meta: MetaEnvelope

class CreateCalendarEventRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=255)
    location: Optional[str] = Field(default=None, max_length=255)
    meta: Optional[str] = Field(default=None, max_length=500)
    starts_at: datetime
    ends_at: datetime
    is_all_day: bool = False

    @model_validator(mode="after")
    def validate_time_chronology(self) -> "CreateCalendarEventRequest":
        if self.ends_at < self.starts_at:
            raise ValueError("ends_at cannot precede starts_at")
        return self

class UpdateCalendarEventRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    location: Optional[str] = Field(default=None, max_length=255)
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None

    @model_validator(mode="after")
    def validate_time_chronology(self) -> "UpdateCalendarEventRequest":
        if self.starts_at and self.ends_at and self.ends_at < self.starts_at:
            raise ValueError("ends_at cannot precede starts_at")
        return self

class InviteCollaboratorItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=255)
    role: str = Field(min_length=1, max_length=100)
    email_or_channel: str = Field(min_length=1, max_length=255)
    is_agent: bool = False
    agent_id: Optional[UUID] = None

    @model_validator(mode="after")
    def validate_agent_consistency(self) -> "InviteCollaboratorItem":
        if self.is_agent and not self.agent_id:
            raise ValueError("agent_id is required when is_agent is True")
        if not self.is_agent and self.agent_id is not None:
            raise ValueError("agent_id must be None when is_agent is False")
        return self

class InviteCollaboratorsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    collaborators: List[InviteCollaboratorItem] = Field(min_length=1)
