from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

@dataclass
class Customer:
    id: UUID = field(default_factory=uuid4)
    name: str = ""
    phone_e164: str = ""
    brand: str = ""
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self):
        if not self.name:
            raise ValueError("Customer name cannot be empty")
        if not self.phone_e164 or not self.phone_e164.startswith("+"):
            raise ValueError(f"Customer phone must be E.164 formatted: {self.phone_e164}")

@dataclass
class Lead:
    id: UUID = field(default_factory=uuid4)
    customer_id: UUID = field(default_factory=uuid4)
    assigned_agent_id: Optional[UUID] = None
    interest: str = ""
    product: str = ""
    cross_sell: Optional[str] = None
    emi_note: Optional[str] = None
    notes: Optional[str] = None
    attractiveness_score: int = 50
    expected_value: Decimal = field(default_factory=lambda: Decimal("0.00"))
    badge: str = "Warm"
    badge_color: str = "#10b981"
    status_label: str = "New Lead"
    icp_score: int = 50
    intent_score: int = 50
    source: str = "Walk-in"
    last_contact_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self):
        if not (0 <= self.attractiveness_score <= 100):
            raise ValueError("attractiveness_score must be between 0 and 100")
        if not (0 <= self.icp_score <= 100):
            raise ValueError("icp_score must be between 0 and 100")
        if not (0 <= self.intent_score <= 100):
            raise ValueError("intent_score must be between 0 and 100")
        if self.expected_value < 0:
            raise ValueError("expected_value must be non-negative")

@dataclass
class BuyingSignal:
    id: UUID = field(default_factory=uuid4)
    lead_id: UUID = field(default_factory=uuid4)
    label: str = ""
    detail: str = ""
    icon: str = "Sparkles"
    detected_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
