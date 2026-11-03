from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4

@dataclass(kw_only=True)
class Kudos:
    agent_id: UUID
    given_by: UUID
    id: UUID = field(default_factory=uuid4)
    reason: str = ""
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self):
        if not self.reason or not self.reason.strip():
            raise ValueError("Kudos reason cannot be empty")
        if self.agent_id == self.given_by:
            raise ValueError("Agents cannot give kudos to themselves")

@dataclass(kw_only=True)
class KudosLike:
    kudos_id: UUID
    agent_id: UUID
    liked_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
