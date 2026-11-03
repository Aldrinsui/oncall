from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID, uuid4

from backend.app.domains.common.enums import ParticipantStatus

@dataclass
class CalendarEvent:
    id: UUID = field(default_factory=uuid4)
    organizer_id: UUID = field(default_factory=uuid4)
    title: str = ""
    location: Optional[str] = None
    session_slug: str = ""
    meta: Optional[str] = None
    starts_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    ends_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    is_all_day: bool = False
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self):
        if not self.title:
            raise ValueError("Event title cannot be empty")
        if not self.session_slug:
            raise ValueError("Session slug cannot be empty")
        if self.ends_at < self.starts_at:
            raise ValueError(f"ends_at ({self.ends_at}) cannot precede starts_at ({self.starts_at})")

@dataclass
class CalendarParticipant:
    id: UUID = field(default_factory=uuid4)
    event_id: UUID = field(default_factory=uuid4)
    is_agent: bool = False
    agent_id: Optional[UUID] = None
    name: str = ""
    role: str = ""
    email_or_channel: str = ""
    status: ParticipantStatus = ParticipantStatus.INVITED
    invited_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    responded_at: Optional[datetime] = None

    def __post_init__(self):
        if not self.name:
            raise ValueError("Participant name cannot be empty")
        if not self.email_or_channel:
            raise ValueError("Participant email_or_channel cannot be empty")
        if self.is_agent and not self.agent_id:
            raise ValueError("agent_id is required when is_agent is True")
