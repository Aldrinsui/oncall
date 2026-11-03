from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from backend.app.domains.common.enums import NotificationAction

@dataclass
class Notification:
    id: UUID = field(default_factory=uuid4)
    agent_id: UUID = field(default_factory=uuid4)
    title: str = ""
    message: str = ""
    icon: str = "Bell"
    color: str = "#6366f1"
    action_type: Optional[NotificationAction] = None
    action_payload: Optional[str] = None
    cta: str = "View"
    is_read: bool = False
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self):
        if not self.title:
            raise ValueError("Notification title cannot be empty")
        if not self.message:
            raise ValueError("Notification message cannot be empty")
