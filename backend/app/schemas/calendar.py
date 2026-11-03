from datetime import datetime
from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel, Field
from backend.app.domains.common.enums import ParticipantStatus
from backend.app.schemas.common import MetaEnvelope

class CalendarParticipantDTO(BaseModel):
    id: UUID
    is_agent: bool = False
    agent_id: Optional[UUID] = None
    name: str
    role: str
    email_or_channel: str
    status: ParticipantStatus = ParticipantStatus.INVITED

class CalendarEventDTO(BaseModel):
    id: UUID
    organizer_id: UUID
    title: str
    location: Optional[str] = None
    session_slug: str
    meta: Optional[str] = None
    starts_at: datetime
    ends_at: datetime
    is_all_day: bool = False
    participants: List[CalendarParticipantDTO] = Field(default_factory=list)

class CalendarEventResponse(BaseModel):
    data: CalendarEventDTO
    meta: MetaEnvelope

class CalendarEventListResponse(BaseModel):
    data: List[CalendarEventDTO]
    meta: MetaEnvelope

class CreateCalendarEventRequest(BaseModel):
    title: str
    location: Optional[str] = None
    meta: Optional[str] = None
    starts_at: datetime
    ends_at: datetime
    is_all_day: bool = False

class UpdateCalendarEventRequest(BaseModel):
    title: Optional[str] = None
    location: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None

class InviteCollaboratorItem(BaseModel):
    name: str
    role: str
    email_or_channel: str
    is_agent: bool = False
    agent_id: Optional[UUID] = None

class InviteCollaboratorsRequest(BaseModel):
    collaborators: List[InviteCollaboratorItem]
