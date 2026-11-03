from datetime import datetime, timezone
from typing import List, Optional, Tuple
from uuid import UUID, uuid4
from fastapi import HTTPException, status
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.auth import AuthenticatedAgent
from backend.app.models.tasks import TaskModel
from backend.app.schemas.tasks import (
    TaskDTO,
    CreateTaskRequest,
    UpdateTaskRequest,
)
from backend.app.domains.common.enums import TaskStatus
from backend.app.services.pulse_service import PulseService

class TaskService:
    @staticmethod
    async def get_tasks(
        agent: AuthenticatedAgent,
        db: AsyncSession,
        channel_slug: Optional[str] = None,
        task_status: Optional[str] = None,
    ) -> List[TaskDTO]:
        """
        List tasks strictly assigned to current authorized agent (Agent Isolation).
        """
        await PulseService.seed_data_if_empty(db)

        clauses = [TaskModel.agent_id == agent.id]
        if channel_slug:
            clean_slug = channel_slug.lstrip("#")
            clauses.append(
                or_(
                    TaskModel.channel_slug == clean_slug,
                    TaskModel.channel_slug.is_(None),
                )
            )
        if task_status:
            clauses.append(TaskModel.status == task_status)

        stmt = select(TaskModel).where(and_(*clauses)).order_by(TaskModel.created_at.asc())
        tasks = (await db.execute(stmt)).scalars().all()

        return [
            TaskDTO(
                id=t.id,
                agent_id=t.agent_id,
                lead_id=t.lead_id,
                channel_slug=t.channel_slug,
                category=t.category,
                title=t.title,
                description=t.description,
                manager_name=t.manager_name,
                status=TaskStatus(t.status) if t.status in TaskStatus.__members__.values() else TaskStatus.PENDING,
                due_date=t.due_date,
                time_window=t.time_window,
                is_acknowledged=t.is_acknowledged,
                acknowledged_at=t.acknowledged_at,
                explanation=t.explanation,
                created_at=t.created_at,
                updated_at=t.updated_at,
            )
            for t in tasks
        ]

    @staticmethod
    async def create_task(
        agent: AuthenticatedAgent,
        req: CreateTaskRequest,
        db: AsyncSession,
    ) -> TaskDTO:
        """
        Create a new task assigned to authorized agent.
        """
        await PulseService.seed_data_if_empty(db)

        now = datetime.now(timezone.utc)
        task = TaskModel(
            agent_id=agent.id,
            title=req.title,
            lead_id=req.lead_id,
            due_date=req.due_date,
            category=req.category or "type_1",
            channel_slug=req.channel_slug.lstrip("#") if req.channel_slug else None,
            time_window=req.time_window,
            description=req.description,
            status=TaskStatus.PENDING.value,
            is_acknowledged=False,
            created_at=now,
            updated_at=now,
        )
        db.add(task)
        await db.commit()
        await db.refresh(task)

        return TaskDTO(
            id=task.id,
            agent_id=task.agent_id,
            lead_id=task.lead_id,
            channel_slug=task.channel_slug,
            category=task.category,
            title=task.title,
            description=task.description,
            manager_name=task.manager_name,
            status=TaskStatus(task.status),
            due_date=task.due_date,
            time_window=task.time_window,
            is_acknowledged=task.is_acknowledged,
            acknowledged_at=task.acknowledged_at,
            explanation=task.explanation,
            created_at=task.created_at,
            updated_at=task.updated_at,
        )

    @staticmethod
    async def update_task(
        task_id: UUID,
        agent: AuthenticatedAgent,
        req: UpdateTaskRequest,
        db: AsyncSession,
    ) -> TaskDTO:
        """
        Update task status, acknowledgement or explanation.
        Strictly enforces that task belongs to the requesting agent (Agent Ownership).
        """
        await PulseService.seed_data_if_empty(db)

        task = await db.get(TaskModel, task_id)
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task {task_id} not found",
            )

        if task.agent_id != agent.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Agent {agent.id} unauthorized to update task owned by agent {task.agent_id}",
            )

        now = datetime.now(timezone.utc)

        if req.title is not None:
            task.title = req.title.strip()
        if req.status is not None:
            task.status = req.status.value
        if req.is_acknowledged is not None:
            task.is_acknowledged = req.is_acknowledged
            if req.is_acknowledged and not task.acknowledged_at:
                task.acknowledged_at = now
        if req.explanation is not None:
            task.explanation = req.explanation.strip()

        task.updated_at = now

        await db.commit()
        await db.refresh(task)

        return TaskDTO(
            id=task.id,
            agent_id=task.agent_id,
            lead_id=task.lead_id,
            channel_slug=task.channel_slug,
            category=task.category,
            title=task.title,
            description=task.description,
            manager_name=task.manager_name,
            status=TaskStatus(task.status) if task.status in TaskStatus.__members__.values() else TaskStatus.PENDING,
            due_date=task.due_date,
            time_window=task.time_window,
            is_acknowledged=task.is_acknowledged,
            acknowledged_at=task.acknowledged_at,
            explanation=task.explanation,
            created_at=task.created_at,
            updated_at=task.updated_at,
        )

    @staticmethod
    async def acknowledge_all_tasks(
        agent: AuthenticatedAgent,
        channel_slug: Optional[str],
        db: AsyncSession,
    ) -> Tuple[int, datetime]:
        """
        Bulk acknowledge today's tasks for current agent.
        CRITICAL: Records acknowledgement WITHOUT marking tasks completed!
        """
        await PulseService.seed_data_if_empty(db)

        clauses = [
            TaskModel.agent_id == agent.id,
            TaskModel.is_acknowledged.is_(False),
        ]
        if channel_slug:
            clean_slug = channel_slug.lstrip("#")
            clauses.append(
                or_(
                    TaskModel.channel_slug == clean_slug,
                    TaskModel.channel_slug.is_(None),
                )
            )

        stmt = select(TaskModel).where(and_(*clauses))
        tasks = (await db.execute(stmt)).scalars().all()

        now = datetime.now(timezone.utc)
        count = len(tasks)
        for t in tasks:
            t.is_acknowledged = True
            t.acknowledged_at = now
            # Do NOT change status to COMPLETED

        await db.commit()
        return count, now
