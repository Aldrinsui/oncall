import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from uuid import UUID, uuid4

from backend.app.domains.common.enums import (
    CallStatus,
    CallDirection,
    CallLegRole,
    CallLegStatus,
    CallEventType,
    EndpointType,
)

E164_REGEX = re.compile(r"^\+[1-9]\d{1,14}$")

@dataclass
class Call:
    id: UUID = field(default_factory=uuid4)
    agent_id: UUID = field(default_factory=uuid4)
    customer_id: UUID = field(default_factory=uuid4)
    lead_id: Optional[UUID] = None
    direction: CallDirection = CallDirection.OUTBOUND
    status: CallStatus = CallStatus.QUEUED
    is_simulated: bool = True
    idempotency_key: str = ""
    request_fingerprint: str = ""
    notes: Optional[str] = None
    wrapup_outcome: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    initiated_at: Optional[datetime] = None
    connected_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None

    @property
    def duration_seconds(self) -> int:
        if self.connected_at and self.ended_at and self.ended_at >= self.connected_at:
            return int((self.ended_at - self.connected_at).total_seconds())
        return 0

    def __post_init__(self):
        if self.initiated_at and self.initiated_at < self.created_at:
            raise ValueError("initiated_at cannot precede created_at")
        if self.connected_at:
            if not self.initiated_at or self.connected_at < self.initiated_at:
                raise ValueError("connected_at cannot precede initiated_at")
        if self.ended_at:
            if self.connected_at and self.ended_at < self.connected_at:
                raise ValueError("ended_at cannot precede connected_at")
            elif not self.connected_at and self.initiated_at and self.ended_at < self.initiated_at:
                raise ValueError("ended_at cannot precede initiated_at")

@dataclass
class CallLeg:
    id: UUID = field(default_factory=uuid4)
    call_id: UUID = field(default_factory=uuid4)
    leg_role: CallLegRole = CallLegRole.AGENT
    attempt_number: int = 1
    provider: str = "mock"
    telephony_leg_id: Optional[str] = None
    to_endpoint_type: EndpointType = EndpointType.WEBRTC
    to_endpoint_uri: str = ""
    from_endpoint_type: EndpointType = EndpointType.WEBRTC
    from_endpoint_uri: str = ""
    status: CallLegStatus = CallLegStatus.INITIATING
    initiated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    answered_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    error_message: Optional[str] = None

    @property
    def duration_seconds(self) -> int:
        if self.answered_at and self.ended_at and self.ended_at >= self.answered_at:
            return int((self.ended_at - self.answered_at).total_seconds())
        return 0

    def __post_init__(self):
        if self.attempt_number < 1:
            raise ValueError("attempt_number must be >= 1")
        if self.to_endpoint_type == EndpointType.PSTN:
            if not E164_REGEX.match(self.to_endpoint_uri):
                raise ValueError(f"Invalid PSTN to_endpoint_uri: {self.to_endpoint_uri}")
        if self.from_endpoint_type == EndpointType.PSTN:
            if not E164_REGEX.match(self.from_endpoint_uri):
                raise ValueError(f"Invalid PSTN from_endpoint_uri: {self.from_endpoint_uri}")
        if self.answered_at and self.answered_at < self.initiated_at:
            raise ValueError("answered_at cannot precede initiated_at")
        if self.ended_at:
            if self.answered_at and self.ended_at < self.answered_at:
                raise ValueError("ended_at cannot precede answered_at")
            elif not self.answered_at and self.ended_at < self.initiated_at:
                raise ValueError("ended_at cannot precede initiated_at")

@dataclass
class CallEvent:
    id: UUID = field(default_factory=uuid4)
    call_id: UUID = field(default_factory=uuid4)
    event_source: str = "MOCK"
    provider: str = "mock"
    provider_event_id: str = ""
    event_type: CallEventType = CallEventType.CALL_CREATED
    payload: Dict[str, Any] = field(default_factory=dict)
    occurred_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    received_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
