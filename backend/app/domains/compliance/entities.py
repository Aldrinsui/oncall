from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from backend.app.domains.common.enums import ConsentState, ConsentMethod

@dataclass
class ConsentRecord:
    id: UUID = field(default_factory=uuid4)
    call_id: UUID = field(default_factory=uuid4)
    customer_id: UUID = field(default_factory=uuid4)
    agent_id: UUID = field(default_factory=uuid4)
    status: ConsentState = ConsentState.PENDING
    method: ConsentMethod = ConsentMethod.VOICE
    language: str = "en-IN"
    verified_text: Optional[str] = None
    is_minor: bool = False
    guardian_phone: Optional[str] = None
    guardian_consent: Optional[bool] = None
    requested_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    consented_at: Optional[datetime] = None

    def __post_init__(self):
        if self.status == ConsentState.GRANTED and not self.consented_at:
            raise ValueError("consented_at is required when status is GRANTED")
        if self.status != ConsentState.GRANTED and self.consented_at is not None:
            raise ValueError("consented_at must be None when status is not GRANTED")

@dataclass
class CallSopReview:
    id: UUID = field(default_factory=uuid4)
    call_id: UUID = field(default_factory=uuid4)
    criterion: str = ""
    passed: bool = False
    score: int = 0
    evidence: str = ""
    reviewed_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self):
        if not (0 <= self.score <= 100):
            raise ValueError(f"SOP review score must be between 0 and 100, got {self.score}")
