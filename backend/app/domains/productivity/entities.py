from dataclasses import dataclass, field
from datetime import datetime, timezone, date
from typing import Optional
from uuid import UUID, uuid4

from backend.app.domains.common.enums import TaskStatus

@dataclass(kw_only=True)
class Task:
    agent_id: UUID
    id: UUID = field(default_factory=uuid4)
    lead_id: Optional[UUID] = None
    title: str = ""
    status: TaskStatus = TaskStatus.PENDING
    due_date: Optional[date] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self):
        if not self.title or not self.title.strip():
            raise ValueError("Task title cannot be empty")
