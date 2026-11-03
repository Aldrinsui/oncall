from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4

@dataclass(kw_only=True)
class RoleplaySession:
    agent_id: UUID
    id: UUID = field(default_factory=uuid4)
    persona_id: str = ""
    current_stage: str = "greeting"
    score: int = 0
    turns_count: int = 0
    closing_goal_met: bool = False
    transcript: List[Dict[str, Any]] = field(default_factory=list)
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    notes: Optional[str] = None

    def __post_init__(self):
        if not (0 <= self.score <= 100):
            raise ValueError(f"Roleplay score must be between 0 and 100, got {self.score}")
        if self.turns_count < 0:
            raise ValueError("turns_count must be non-negative")
