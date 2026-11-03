from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, List, Any
from uuid import UUID, uuid4

@dataclass
class Channel:
    id: UUID = field(default_factory=uuid4)
    store: str = ""
    name: str = ""
    description: Optional[str] = None
    icon: str = "Hash"
    color: str = "#6366f1"
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self):
        if not self.store:
            raise ValueError("Channel store cannot be empty (store-level isolation required)")
        if not self.name:
            raise ValueError("Channel name cannot be empty")

@dataclass
class Message:
    id: UUID = field(default_factory=uuid4)
    channel_id: UUID = field(default_factory=uuid4)
    sender_id: UUID = field(default_factory=uuid4)
    body: str = ""
    sent_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self):
        if not self.body:
            raise ValueError("Message body cannot be empty")

@dataclass
class MessageRead:
    agent_id: UUID = field(default_factory=uuid4)
    message_id: UUID = field(default_factory=uuid4)
    read_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

@dataclass
class PulsePinnedItem:
    id: UUID = field(default_factory=uuid4)
    channel_id: UUID = field(default_factory=uuid4)
    question: str = ""
    options: List[str] = field(default_factory=list)
    meta: Optional[str] = None
    urgency: str = "mid"
    is_active: bool = True
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self):
        if not self.question:
            raise ValueError("Pinned item question cannot be empty")

@dataclass
class PulsePinnedResponse:
    id: UUID = field(default_factory=uuid4)
    pinned_item_id: UUID = field(default_factory=uuid4)
    agent_id: UUID = field(default_factory=uuid4)
    selected_option: str = ""
    responded_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self):
        if not self.selected_option:
            raise ValueError("Selected option cannot be empty")
