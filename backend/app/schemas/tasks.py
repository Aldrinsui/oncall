from datetime import datetime, date
from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from backend.app.domains.common.enums import TaskStatus
from backend.app.schemas.common import MetaEnvelope

class TaskDTO(BaseModel):
    id: UUID
    agent_id: Optional[UUID] = None
    lead_id: Optional[UUID] = None
    channel_slug: Optional[str] = None
    category: Optional[str] = "type_1"
    title: str
    description: Optional[str] = None
    manager_name: Optional[str] = None
    status: TaskStatus = TaskStatus.PENDING
    due_date: Optional[date] = None
    time_window: Optional[str] = None
    is_acknowledged: bool = False
    acknowledged_at: Optional[datetime] = None
    explanation: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

class TaskResponse(BaseModel):
    data: TaskDTO
    meta: MetaEnvelope

class TaskListResponse(BaseModel):
    data: List[TaskDTO]
    meta: MetaEnvelope

class CreateTaskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=255)
    lead_id: Optional[UUID] = None
    due_date: Optional[date] = None
    category: Optional[str] = "type_1"
    channel_slug: Optional[str] = None
    time_window: Optional[str] = None
    description: Optional[str] = None

class UpdateTaskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    status: Optional[TaskStatus] = None
    is_acknowledged: Optional[bool] = None
    explanation: Optional[str] = None

class BulkAcknowledgeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    channel_slug: Optional[str] = None

class BulkAcknowledgeResponseData(BaseModel):
    acknowledged_count: int
    acknowledged_at: datetime
    status_summary: str

class BulkAcknowledgeResponse(BaseModel):
    data: BulkAcknowledgeResponseData
    meta: MetaEnvelope
