from datetime import datetime
from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel
from backend.app.schemas.common import MetaEnvelope

class NotificationDTO(BaseModel):
    id: UUID
    title: str
    message: str
    icon: str = "Bell"
    color: str = "#6366f1"
    action_type: Optional[str] = None
    action_payload: Optional[str] = None
    cta: str = "View"
    is_read: bool = False
    created_at: datetime

class NotificationListResponse(BaseModel):
    data: List[NotificationDTO]
    meta: MetaEnvelope
