from uuid import UUID, uuid4
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import (
    String,
    Boolean,
    DateTime,
    Integer,
    Text,
    JSON,
    ForeignKey,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base

class PulseChannelModel(Base):
    __tablename__ = "pulse_channels"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    store: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    icon: Mapped[str] = mapped_column(String(50), default="Hash", nullable=False)
    color: Mapped[str] = mapped_column(String(30), default="#6366f1", nullable=False)
    channel_type: Mapped[str] = mapped_column(String(50), default="channel", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    messages = relationship("PulseMessageModel", back_populates="channel", cascade="all, delete-orphan")
    pinned_items = relationship("PulsePinnedItemModel", back_populates="channel", cascade="all, delete-orphan")

class PulseMessageModel(Base):
    __tablename__ = "pulse_messages"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    channel_id: Mapped[UUID] = mapped_column(ForeignKey("pulse_channels.id", ondelete="CASCADE"), index=True, nullable=False)
    sender_id: Mapped[UUID] = mapped_column(nullable=False, index=True)
    sender_name: Mapped[str] = mapped_column(String(255), nullable=False)
    sender_initials: Mapped[str] = mapped_column(String(10), default="??", nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    is_agent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    channel = relationship("PulseChannelModel", back_populates="messages")

class PulseMessageReadModel(Base):
    __tablename__ = "pulse_message_reads"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    channel_id: Mapped[UUID] = mapped_column(ForeignKey("pulse_channels.id", ondelete="CASCADE"), index=True, nullable=False)
    message_id: Mapped[UUID] = mapped_column(nullable=False)
    agent_id: Mapped[UUID] = mapped_column(nullable=False, index=True)
    read_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("channel_id", "message_id", "agent_id", name="uq_channel_message_agent_read"),
    )

class PulsePinnedItemModel(Base):
    __tablename__ = "pulse_pinned_items"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    channel_id: Mapped[UUID] = mapped_column(ForeignKey("pulse_channels.id", ondelete="CASCADE"), index=True, nullable=False)
    question: Mapped[str] = mapped_column(String(500), nullable=False)
    options: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    meta: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    urgency: Mapped[str] = mapped_column(String(20), default="mid", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    pinned_by_id: Mapped[Optional[UUID]] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    channel = relationship("PulseChannelModel", back_populates="pinned_items")
    responses = relationship("PulsePinnedResponseModel", back_populates="pinned_item", cascade="all, delete-orphan")

class PulsePinnedResponseModel(Base):
    __tablename__ = "pulse_pinned_responses"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    pinned_item_id: Mapped[UUID] = mapped_column(ForeignKey("pulse_pinned_items.id", ondelete="CASCADE"), index=True, nullable=False)
    agent_id: Mapped[UUID] = mapped_column(nullable=False, index=True)
    selected_option: Mapped[str] = mapped_column(String(255), nullable=False)
    custom_reply: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    responded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    pinned_item = relationship("PulsePinnedItemModel", back_populates="responses")

    __table_args__ = (
        UniqueConstraint("pinned_item_id", "agent_id", name="uq_pinned_item_agent_response"),
    )

class AgentMetricModel(Base):
    __tablename__ = "agent_metrics"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    channel_slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    agent_type: Mapped[str] = mapped_column(String(50), nullable=False)  # "role" or "task"
    icon: Mapped[str] = mapped_column(String(50), default="Bot", nullable=False)
    color: Mapped[str] = mapped_column(String(30), default="#1d4ed8", nullable=False)
    scope: Mapped[str] = mapped_column(String(255), nullable=False)
    metric_name: Mapped[str] = mapped_column(String(100), nullable=False)
    target_value: Mapped[int] = mapped_column(Integer, nullable=False)
    current_value: Mapped[int] = mapped_column(Integer, nullable=False)
    change_value: Mapped[int] = mapped_column(Integer, nullable=False)
    items_label: Mapped[str] = mapped_column(String(100), nullable=False)
    source_attribution: Mapped[str] = mapped_column(
        String(255),
        default="Sample shift benchmark - Koramangala store",
        nullable=False,
    )
    did_well: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    improve: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    focus: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    win: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    good_at: Mapped[Optional[list]] = mapped_column(JSON, default=list, nullable=True)
    work_on: Mapped[Optional[list]] = mapped_column(JSON, default=list, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
