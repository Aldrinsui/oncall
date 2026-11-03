import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import (
    String,
    Boolean,
    Integer,
    DateTime,
    ForeignKey,
    CheckConstraint,
    UniqueConstraint,
    Index,
    Uuid,
    JSON,
    Enum as SAEnum,
    desc,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base
from backend.app.domains.common.enums import (
    CallStatus,
    CallLegRole,
    CallLegStatus,
    CallEventType,
)

class CallModel(Base):
    __tablename__ = "calls"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    agent_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    customer_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    lead_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, nullable=True)
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False, default="Customer")
    customer_phone: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    direction: Mapped[str] = mapped_column(String(16), nullable=False, default="OUTBOUND")
    status: Mapped[CallStatus] = mapped_column(
        SAEnum(CallStatus, name="call_status", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=CallStatus.QUEUED,
    )
    is_simulated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    request_fingerprint: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    notes: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    wrapup_outcome: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    initiated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    connected_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    ended_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    legs: Mapped[List["CallLegModel"]] = relationship(
        "CallLegModel", back_populates="call", cascade="all, delete-orphan", lazy="selectin"
    )
    events: Mapped[List["CallEventModel"]] = relationship(
        "CallEventModel", back_populates="call", cascade="all, delete-orphan", lazy="selectin"
    )

class CallLegModel(Base):
    __tablename__ = "call_legs"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    call_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("calls.id", ondelete="CASCADE"), nullable=False
    )
    leg_role: Mapped[CallLegRole] = mapped_column(
        SAEnum(CallLegRole, name="call_leg_role", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=CallLegRole.AGENT,
    )
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    provider: Mapped[str] = mapped_column(String(64), nullable=False, default="twilio")
    telephony_leg_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    to_endpoint_type: Mapped[str] = mapped_column(String(32), nullable=False, default="PSTN")
    to_endpoint_uri: Mapped[str] = mapped_column(String(255), nullable=False)
    from_endpoint_type: Mapped[str] = mapped_column(String(32), nullable=False, default="PSTN")
    from_endpoint_uri: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[CallLegStatus] = mapped_column(
        SAEnum(CallLegStatus, name="call_leg_status", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=CallLegStatus.INITIATING,
    )
    initiated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    answered_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    ended_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_message: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    call: Mapped["CallModel"] = relationship("CallModel", back_populates="legs")

class CallEventModel(Base):
    __tablename__ = "call_events"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    call_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("calls.id", ondelete="CASCADE"), nullable=False
    )
    event_source: Mapped[str] = mapped_column(String(64), nullable=False, default="PROVIDER")
    provider: Mapped[str] = mapped_column(String(64), nullable=False, default="twilio")
    provider_event_id: Mapped[str] = mapped_column(String(255), nullable=False)
    event_type: Mapped[CallEventType] = mapped_column(
        SAEnum(CallEventType, name="call_event_type", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    payload: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    call: Mapped["CallModel"] = relationship("CallModel", back_populates="events")
