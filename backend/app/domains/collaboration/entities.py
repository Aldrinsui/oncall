from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID, uuid4

@dataclass(kw_only=True)
class Channel:
    id: UUID = field(default_factory=uuid4)
    store: str = ""
    name: str = ""
    description: Optional[str] = None
    icon: str = "Hash"
    color: str = "#6366f1"
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self):
        if not self.store or not self.store.strip():
            raise ValueError("Channel store cannot be empty (store-level isolation required)")
        if not self.name or not self.name.strip():
            raise ValueError("Channel name cannot be empty")

@dataclass(kw_only=True)
class Message:
    channel_id: UUID
    sender_id: UUID
    id: UUID = field(default_factory=uuid4)
    body: str = ""
    sent_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self):
        if not self.body or not self.body.strip():
            raise ValueError("Message body cannot be empty")

@dataclass(kw_only=True)
class MessageRead:
    channel_id: UUID
    message_id: UUID
    agent_id: UUID
    read_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

@dataclass(kw_only=True)
class PulsePinnedItem:
    channel_id: UUID
    id: UUID = field(default_factory=uuid4)
    pinned_by_id: Optional[UUID] = None
    question: str = ""
    options: List[str] = field(default_factory=list)
    meta: Optional[str] = None
    urgency: str = "mid"
    is_active: bool = True
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self):
        if not self.question or not self.question.strip():
            raise ValueError("Pinned item question cannot be empty")

@dataclass(kw_only=True)
class PulsePinnedResponse:
    pinned_item_id: UUID
    agent_id: UUID
    id: UUID = field(default_factory=uuid4)
    selected_option: str = ""
    responded_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self):
        if not self.selected_option or not self.selected_option.strip():
            raise ValueError("Selected option cannot be empty")
