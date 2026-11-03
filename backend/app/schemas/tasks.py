from datetime import datetime, date
from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from backend.app.domains.common.enums import TaskStatus
from backend.app.schemas.common import MetaEnvelope

class TaskDTO(BaseModel):
    id: UUID
    lead_id: Optional[UUID] = None
    title: str
    status: TaskStatus = TaskStatus.PENDING
    due_date: Optional[date] = None
    created_at: datetime

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

class UpdateTaskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    status: Optional[TaskStatus] = None
