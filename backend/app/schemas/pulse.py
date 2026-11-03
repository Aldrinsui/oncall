from datetime import datetime
from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from backend.app.schemas.common import MetaEnvelope

class PulseChannelDTO(BaseModel):
    id: UUID
    name: str
    store: str
    description: Optional[str] = None
    icon: str = "Hash"
    color: str = "#6366f1"
    unread_count: int = Field(default=0, ge=0)
    channel_type: Optional[str] = "channel"
    channel_slug: Optional[str] = None
    metric_name: Optional[str] = None
    target_value: Optional[int] = None
    current_value: Optional[int] = None
    change_value: Optional[int] = None
    items_label: Optional[str] = None
    scope: Optional[str] = None
    source_attribution: Optional[str] = None

class PulseChannelListResponse(BaseModel):
    data: List[PulseChannelDTO]
    meta: MetaEnvelope

class PulseMessageDTO(BaseModel):
    id: UUID
    channel_id: UUID
    sender_id: UUID
    sender_name: str
    sender_initials: str
    body: str
    sent_at: datetime
    is_current_agent: bool = False

class PulseMessageListResponse(BaseModel):
    data: List[PulseMessageDTO]
    meta: MetaEnvelope

class PulseMessageResponse(BaseModel):
    data: PulseMessageDTO
    meta: MetaEnvelope

class PostMessageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    body: str = Field(min_length=1, max_length=5000)

class PinnedItemDTO(BaseModel):
    id: UUID
    channel_id: UUID
    question: str
    options: List[str] = Field(default_factory=list)
    meta: Optional[str] = None
    urgency: str = "mid"
    is_answered: bool = False
    selected_option: Optional[str] = None
    custom_reply: Optional[str] = None

class PinnedItemListResponse(BaseModel):
    data: List[PinnedItemDTO]
    meta: MetaEnvelope

class PinnedItemResponseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    selected_option: str = Field(min_length=1, max_length=255)
    custom_reply: Optional[str] = Field(default=None, max_length=1000)

class AgentCatalogItemDTO(BaseModel):
    id: UUID
    channel_slug: str
    name: str
    agent_type: str  # "role" or "task"
    icon: str
    color: str
    scope: str
    metric_name: str
    target_value: int
    current_value: int
    change_value: int
    items_label: str
    source_attribution: str
    status: str = "Active"
    did_well: Optional[str] = None
    improve: Optional[str] = None
    focus: Optional[str] = None
    win: Optional[str] = None
    good_at: List[str] = Field(default_factory=list)
    work_on: List[str] = Field(default_factory=list)

class AgentCatalogListResponse(BaseModel):
    data: List[AgentCatalogItemDTO]
    meta: MetaEnvelope

class ChannelContextDTO(BaseModel):
    channel_slug: str
    channel_name: str
    manager_context: str
    digest_time: str
    metric_name: str
    target_value: int
    current_value: int
    change_value: int
    did_well: str
    improve: str
    items_label: str
    unacknowledged_task_count: int
    tasks: List[dict] = Field(default_factory=list)
    soft_tasks: dict = Field(default_factory=dict)

class ChannelContextResponse(BaseModel):
    data: ChannelContextDTO
    meta: MetaEnvelope
