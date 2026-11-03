from datetime import datetime
from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel, Field
from backend.app.schemas.common import MetaEnvelope

class PulseChannelDTO(BaseModel):
    id: UUID
    name: str
    store: str
    description: Optional[str] = None
    icon: str = "Hash"
    color: str = "#6366f1"
    unread_count: int = Field(default=0, ge=0)

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
    body: str

class PinnedItemDTO(BaseModel):
    id: UUID
    channel_id: UUID
    question: str
    options: List[str] = Field(default_factory=list)
    meta: Optional[str] = None
    urgency: str = "mid"
    is_answered: bool = False
    selected_option: Optional[str] = None

class PinnedItemListResponse(BaseModel):
    data: List[PinnedItemDTO]
    meta: MetaEnvelope

class PinnedItemResponseRequest(BaseModel):
    selected_option: str
