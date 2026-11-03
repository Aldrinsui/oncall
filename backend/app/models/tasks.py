from uuid import UUID, uuid4
from datetime import datetime, timezone, date
from typing import Optional
from sqlalchemy import (
    String,
    Boolean,
    DateTime,
    Date,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column
from backend.app.core.database import Base
from backend.app.domains.common.enums import TaskStatus

class TaskModel(Base):
    __tablename__ = "tasks"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    agent_id: Mapped[UUID] = mapped_column(nullable=False, index=True)
    channel_slug: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    lead_id: Mapped[Optional[UUID]] = mapped_column(nullable=True, index=True)
    category: Mapped[str] = mapped_column(String(50), default="type_1", nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    manager_name: Mapped[Optional[str]] = mapped_column(String(255), default="Sunita Rao", nullable=True)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    time_window: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default=TaskStatus.PENDING.value, nullable=False)
    is_acknowledged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
