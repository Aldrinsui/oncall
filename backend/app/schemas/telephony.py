from datetime import datetime
from uuid import UUID
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from backend.app.domains.common.enums import (
    CallStatus,
    CallLegRole,
    CallLegStatus,
    CallEventType,
)
from backend.app.schemas.common import MetaEnvelope

class CallLegDTO(BaseModel):
    id: UUID
    leg_role: CallLegRole
    attempt_number: int = Field(default=1, ge=1)
    provider: str
    telephony_leg_id: Optional[str] = None
    to_endpoint_type: str
    to_endpoint_uri: str
    from_endpoint_type: str
    from_endpoint_uri: str
    status: CallLegStatus
    initiated_at: datetime
    answered_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_seconds: int = Field(default=0, ge=0)

class CallDTO(BaseModel):
    id: UUID
    agent_id: UUID
    customer_id: UUID
    customer_name: str
    lead_id: Optional[UUID] = None
    direction: str
    status: CallStatus
    is_simulated: bool = True
    notes: Optional[str] = None
    wrapup_outcome: Optional[str] = None
    created_at: datetime
    initiated_at: Optional[datetime] = None
    connected_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_seconds: int = Field(default=0, ge=0)
    legs: List[CallLegDTO] = Field(default_factory=list)

class CallDetailResponse(BaseModel):
    data: CallDTO
    meta: MetaEnvelope

class InitiateCallRequest(BaseModel):
    customer_id: UUID
    lead_id: Optional[UUID] = None
    direction: str = "OUTBOUND"

class WrapupRequest(BaseModel):
    outcome: str
    notes: Optional[str] = None

class CallQueueItemDTO(BaseModel):
    id: UUID
    name: str
    initials: str
    phone: str
    wait: str
    wait_level: str
    intent: str

class CallQueueResponse(BaseModel):
    data: List[CallQueueItemDTO]
    meta: MetaEnvelope

class RecentCallDTO(BaseModel):
    id: UUID
    name: str
    initials: str
    direction: str
    duration: str
    time: str
    outcome: str
    outcome_color: str
    sop_score: Optional[int] = None

class RecentCallListResponse(BaseModel):
    data: List[RecentCallDTO]
    meta: MetaEnvelope

class CallEventDTO(BaseModel):
    id: UUID
    call_id: UUID
    event_type: CallEventType
    occurred_at: datetime
    received_at: datetime

class CallEventListResponse(BaseModel):
    data: List[CallEventDTO]
    meta: MetaEnvelope

class TelephonyWebhookPayload(BaseModel):
    provider: str
    provider_event_id: str
    call_id: UUID
    telephony_leg_id: Optional[str] = None
    event_type: str
    occurred_at: datetime
    payload: Dict[str, Any] = Field(default_factory=dict)

class WebhookAckData(BaseModel):
    status: str

class WebhookAckResponse(BaseModel):
    data: WebhookAckData
    meta: MetaEnvelope
