from datetime import datetime, timezone
from uuid import UUID, uuid4
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.core.auth import get_current_agent, AuthenticatedAgent
from backend.app.schemas.common import MetaEnvelope, AckResponse, AckData
from backend.app.schemas.pulse import (
    PulseChannelListResponse,
    PulseMessageListResponse,
    PulseMessageResponse,
    PostMessageRequest,
    PinnedItemListResponse,
    PinnedItemResponseRequest,
    AgentCatalogListResponse,
    ChannelContextResponse,
)
from backend.app.services.pulse_service import PulseService

router = APIRouter(prefix="/pulse", tags=["Pulse"])

def make_meta() -> MetaEnvelope:
    return MetaEnvelope(
        request_id=uuid4(),
        timestamp=datetime.now(timezone.utc),
    )

@router.get("/channels", response_model=PulseChannelListResponse)
async def list_pulse_channels(
    agent: AuthenticatedAgent = Depends(get_current_agent),
    db: AsyncSession = Depends(get_db),
):
    """
    List store-authorized Pulse channels with dynamically derived unread message counts.
    """
    channels = await PulseService.get_channels(agent, db)
    return PulseChannelListResponse(data=channels, meta=make_meta())

@router.get("/channels/{id}/messages", response_model=PulseMessageListResponse)
async def get_channel_messages(
    id: UUID,
    limit: int = Query(50, ge=1, le=100),
    agent: AuthenticatedAgent = Depends(get_current_agent),
    db: AsyncSession = Depends(get_db),
):
    """
    Get paginated message thread for channel with store authorization check.
    """
    messages = await PulseService.get_messages(id, agent, db, limit)
    return PulseMessageListResponse(data=messages, meta=make_meta())

@router.post("/channels/{id}/messages", response_model=PulseMessageResponse, status_code=status.HTTP_201_CREATED)
async def post_channel_message(
    id: UUID,
    request: PostMessageRequest,
    agent: AuthenticatedAgent = Depends(get_current_agent),
    db: AsyncSession = Depends(get_db),
):
    """
    Post a message to a Pulse channel.
    """
    message = await PulseService.post_message(id, agent, request.body, db)
    return PulseMessageResponse(data=message, meta=make_meta())

@router.post("/channels/{id}/read", response_model=AckResponse)
async def mark_channel_read(
    id: UUID,
    agent: AuthenticatedAgent = Depends(get_current_agent),
    db: AsyncSession = Depends(get_db),
):
    """
    Mark all messages in a channel as read for the current agent.
    """
    await PulseService.mark_channel_read(id, agent, db)
    return AckResponse(data=AckData(success=True), meta=make_meta())

@router.get("/channels/{id}/pinned-items", response_model=PinnedItemListResponse)
async def get_pinned_items(
    id: UUID,
    agent: AuthenticatedAgent = Depends(get_current_agent),
    db: AsyncSession = Depends(get_db),
):
    """
    Get active pinned action cards for channel with agent-independent response state.
    """
    items = await PulseService.get_pinned_items(id, agent, db)
    return PinnedItemListResponse(data=items, meta=make_meta())

@router.post("/pinned-items/{id}/respond", response_model=AckResponse)
async def respond_to_pinned_item(
    id: UUID,
    request: PinnedItemResponseRequest,
    agent: AuthenticatedAgent = Depends(get_current_agent),
    db: AsyncSession = Depends(get_db),
):
    """
    Submit persistent agent response to pinned action card.
    """
    await PulseService.respond_pinned_item(
        id,
        agent,
        request.selected_option,
        request.custom_reply,
        db,
    )
    return AckResponse(data=AckData(success=True), meta=make_meta())

@router.get("/agents", response_model=AgentCatalogListResponse)
async def get_agent_catalog(
    agent: AuthenticatedAgent = Depends(get_current_agent),
    db: AsyncSession = Depends(get_db),
):
    """
    Get catalog of specialized role and task agents with persisted benchmarks and source attribution.
    """
    catalog = await PulseService.get_agent_catalog(agent, db)
    return AgentCatalogListResponse(data=catalog, meta=make_meta())

@router.get("/channels/{slug_or_id}/context", response_model=ChannelContextResponse)
async def get_channel_context(
    slug_or_id: str,
    agent: AuthenticatedAgent = Depends(get_current_agent),
    db: AsyncSession = Depends(get_db),
):
    """
    Get channel-specific context, soft tasks, and personalized task list for authorized agent.
    """
    context = await PulseService.get_channel_context(slug_or_id, agent, db)
    return ChannelContextResponse(data=context, meta=make_meta())
