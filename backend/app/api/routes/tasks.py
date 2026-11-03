from datetime import datetime, timezone
from uuid import UUID, uuid4
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.core.auth import get_current_agent, AuthenticatedAgent
from backend.app.schemas.common import MetaEnvelope
from backend.app.schemas.tasks import (
    TaskListResponse,
    TaskResponse,
    CreateTaskRequest,
    UpdateTaskRequest,
    BulkAcknowledgeRequest,
    BulkAcknowledgeResponse,
    BulkAcknowledgeResponseData,
)
from backend.app.services.task_service import TaskService

router = APIRouter(prefix="/tasks", tags=["Productivity"])

def make_meta() -> MetaEnvelope:
    return MetaEnvelope(
        request_id=uuid4(),
        timestamp=datetime.now(timezone.utc),
    )

@router.get("", response_model=TaskListResponse)
async def list_tasks(
    channel: Optional[str] = Query(None, description="Optional channel slug filter"),
    status: Optional[str] = Query(None, description="Optional status filter"),
    agent: AuthenticatedAgent = Depends(get_current_agent),
    db: AsyncSession = Depends(get_db),
):
    """
    List daily tasks for authorized agent (enforces agent isolation).
    """
    tasks = await TaskService.get_tasks(agent, db, channel_slug=channel, task_status=status)
    return TaskListResponse(data=tasks, meta=make_meta())

@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    request: CreateTaskRequest,
    agent: AuthenticatedAgent = Depends(get_current_agent),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new task assigned to authorized agent.
    """
    task = await TaskService.create_task(agent, request, db)
    return TaskResponse(data=task, meta=make_meta())

@router.patch("/{id}", response_model=TaskResponse)
async def update_task(
    id: UUID,
    request: UpdateTaskRequest,
    agent: AuthenticatedAgent = Depends(get_current_agent),
    db: AsyncSession = Depends(get_db),
):
    """
    Update task status, acknowledgement state or title.
    Enforces task ownership validation.
    """
    task = await TaskService.update_task(id, agent, request, db)
    return TaskResponse(data=task, meta=make_meta())

@router.post("/acknowledge", response_model=BulkAcknowledgeResponse)
async def acknowledge_tasks(
    request: Optional[BulkAcknowledgeRequest] = None,
    agent: AuthenticatedAgent = Depends(get_current_agent),
    db: AsyncSession = Depends(get_db),
):
    """
    Bulk acknowledge tasks for authorized agent.
    Records acknowledgement timestamp without marking tasks completed.
    """
    slug = request.channel_slug if request else None
    count, ack_time = await TaskService.acknowledge_all_tasks(agent, slug, db)
    return BulkAcknowledgeResponse(
        data=BulkAcknowledgeResponseData(
            acknowledged_count=count,
            acknowledged_at=ack_time,
            status_summary=f"Acknowledged {count} tasks. Tasks remain open in their current status.",
        ),
        meta=make_meta(),
    )
