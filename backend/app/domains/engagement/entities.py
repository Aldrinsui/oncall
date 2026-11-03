from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4

@dataclass
class Kudos:
    id: UUID = field(default_factory=uuid4)
    agent_id: UUID = field(default_factory=uuid4)
    given_by: UUID = field(default_factory=uuid4)
    reason: str = ""
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self):
        if not self.reason:
            raise ValueError("Kudos reason cannot be empty")
        if self.agent_id == self.given_by:
            raise ValueError("Agents cannot give kudos to themselves")

@dataclass
class KudosLike:
    kudos_id: UUID = field(default_factory=uuid4)
    agent_id: UUID = field(default_factory=uuid4)
    liked_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
