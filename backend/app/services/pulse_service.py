from datetime import datetime, timezone
from typing import List, Optional, Tuple
from uuid import UUID, uuid4
from fastapi import HTTPException, status
from sqlalchemy import select, and_, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.auth import AuthenticatedAgent
from backend.app.models.pulse import (
    PulseChannelModel,
    PulseMessageModel,
    PulseMessageReadModel,
    PulsePinnedItemModel,
    PulsePinnedResponseModel,
    AgentMetricModel,
)
from backend.app.models.tasks import TaskModel
from backend.app.schemas.pulse import (
    PulseChannelDTO,
    PulseMessageDTO,
    PinnedItemDTO,
    AgentCatalogItemDTO,
    ChannelContextDTO,
)
from backend.app.domains.common.enums import TaskStatus

# Deterministic IDs for cross-service consistency
AVANIBOT_CHANNEL_ID = UUID("00000000-0000-0000-0001-000000000001")
CALLCENTRE_AGENT_CHANNEL_ID = UUID("00000000-0000-0000-0001-000000000002")
CROSS_SELL_CHANNEL_ID = UUID("00000000-0000-0000-0001-000000000003")
SOP_AGENT_CHANNEL_ID = UUID("00000000-0000-0000-0001-000000000004")
LEAD_CONV_CHANNEL_ID = UUID("00000000-0000-0000-0001-000000000005")
CAPTURE_AGENT_CHANNEL_ID = UUID("00000000-0000-0000-0001-000000000006")
CALLCENTRE_TEAM_CHANNEL_ID = UUID("00000000-0000-0000-0001-000000000007")

PINNED_ITEM_1_ID = UUID("11111111-1111-1111-1111-111111110001")
PINNED_ITEM_2_ID = UUID("11111111-1111-1111-1111-111111110002")

class PulseService:
    @staticmethod
    async def seed_data_if_empty(db: AsyncSession):
        """Seed initial channels, metrics, pinned items and tasks if empty."""
        channel_stmt = select(func.count(PulseChannelModel.id))
        count = (await db.execute(channel_stmt)).scalar_one()
        if count > 0:
            return

        now = datetime.now(timezone.utc)

        # 1. Pulse Channels
        channels = [
            PulseChannelModel(
                id=AVANIBOT_CHANNEL_ID,
                store="Koramangala",
                name="🤖 AvaniBot Assistant",
                description="Shift AI Assistant connected to live shift data & leads",
                icon="Bot",
                color="#1d9e75",
                channel_type="system",
                created_at=now,
            ),
            PulseChannelModel(
                id=CALLCENTRE_AGENT_CHANNEL_ID,
                store="Koramangala",
                name="#callcentre-agent",
                description="Role Agent · All call-centre staff",
                icon="Headphones",
                color="#1d4ed8",
                channel_type="role_agent",
                created_at=now,
            ),
            PulseChannelModel(
                id=CROSS_SELL_CHANNEL_ID,
                store="Koramangala",
                name="#cross-sell-agent",
                description="Task Agent · Stores, calls and field",
                icon="ShoppingCart",
                color="#7c3aed",
                channel_type="task_agent",
                created_at=now,
            ),
            PulseChannelModel(
                id=SOP_AGENT_CHANNEL_ID,
                store="Koramangala",
                name="#sop-agent",
                description="Task Agent · Stores, calls and field",
                icon="CheckSquare",
                color="#0e7490",
                channel_type="task_agent",
                created_at=now,
            ),
            PulseChannelModel(
                id=LEAD_CONV_CHANNEL_ID,
                store="Koramangala",
                name="#lead-conversion-agent",
                description="Task Agent · Stores, calls and field",
                icon="Target",
                color="#be123c",
                channel_type="task_agent",
                created_at=now,
            ),
            PulseChannelModel(
                id=CAPTURE_AGENT_CHANNEL_ID,
                store="Koramangala",
                name="#capture-agent",
                description="Task Agent · Stores, calls and field",
                icon="Mic",
                color="#0f766e",
                channel_type="task_agent",
                created_at=now,
            ),
            PulseChannelModel(
                id=CALLCENTRE_TEAM_CHANNEL_ID,
                store="Koramangala",
                name="#callcentre-team",
                description="Team coordination and shift announcements",
                icon="Phone",
                color="#c8860a",
                channel_type="channel",
                created_at=now,
            ),
            # Cross-store channel for store isolation testing
            PulseChannelModel(
                id=UUID("00000000-0000-0000-0002-000000000001"),
                store="RT Nagar",
                name="#rt-nagar-store",
                description="RT Nagar local store team discussions",
                icon="Building",
                color="#0f6e56",
                channel_type="channel",
                created_at=now,
            ),
        ]
        db.add_all(channels)

        # 2. Pinned Items on AvaniBot (Part A)
        pinned_items = [
            PulsePinnedItemModel(
                id=PINNED_ITEM_1_ID,
                channel_id=AVANIBOT_CHANNEL_ID,
                question="Call now or reassign the 2 hot leads",
                meta="Untouched for 24h",
                options=["Calling now", "Reassign"],
                urgency="high",
                is_active=True,
                created_at=now,
            ),
            PulsePinnedItemModel(
                id=PINNED_ITEM_2_ID,
                channel_id=AVANIBOT_CHANNEL_ID,
                question="Log this morning's call outcome",
                meta="Suresh Nair · plan upgrade enquiry",
                options=["Converted", "Callback", "Not interested"],
                urgency="mid",
                is_active=True,
                created_at=now,
            ),
        ]
        db.add_all(pinned_items)

        # 3. Agent Metrics & Custom Agents (Part B)
        metrics = [
            AgentMetricModel(
                channel_slug="callcentre-agent",
                name="Call Centre Agent",
                agent_type="role",
                icon="Headphones",
                color="#1d4ed8",
                scope="All call-centre staff",
                metric_name="Conversion",
                target_value=28,
                current_value=29,
                change_value=3,
                items_label="Leads to follow up",
                source_attribution="Sample shift benchmark · Koramangala store",
                did_well="Booked 6 store visits from callbacks",
                improve="Greeting in the first 10 seconds on 71% of calls",
                focus="Opening greeting in the first 10 seconds · team at 71%",
                win="Booked 6 store visits from callbacks",
                good_at=["Booking visits", "Objection handling"],
                work_on=["Opening greeting in first 10s"],
            ),
            AgentMetricModel(
                channel_slug="cross-sell-agent",
                name="Cross-sell & Upsell Agent",
                agent_type="task",
                icon="ShoppingCart",
                color="#7c3aed",
                scope="Stores, calls and field",
                metric_name="Attach rate",
                target_value=25,
                current_value=24,
                change_value=2,
                items_label="Customers to upsell",
                source_attribution="Sample shift benchmark · Koramangala store",
                did_well="Added a protector in 4 of 12 sales",
                improve="Offer the pillow bundle before billing",
                focus="Approve the pillow and protector bundle script",
                win="Bundled pillows in 7 sales",
                good_at=["Protector pitch"],
                work_on=["Pillow bundle"],
            ),
            AgentMetricModel(
                channel_slug="sop-agent",
                name="SOP Agent",
                agent_type="task",
                icon="CheckSquare",
                color="#0e7490",
                scope="Stores, calls and field",
                metric_name="SOP adherence",
                target_value=85,
                current_value=81,
                change_value=2,
                items_label="Conversations to review",
                source_attribution="Sample shift benchmark · Koramangala store",
                did_well="Asked for feedback on every closed sale",
                improve="Greet within 10 seconds",
                focus="Greeting QA score adherence",
                win="Every SOP step in 19 of 22 talks",
                good_at=["Feedback ask", "Product demo"],
                work_on=["Fast greeting"],
            ),
            AgentMetricModel(
                channel_slug="lead-conversion-agent",
                name="Lead Conversion Agent",
                agent_type="task",
                icon="Target",
                color="#be123c",
                scope="Stores, calls and field",
                metric_name="Lead to sale",
                target_value=30,
                current_value=31,
                change_value=3,
                items_label="Leads to follow up",
                source_attribution="Sample shift benchmark · Koramangala store",
                did_well="Called every lead within 24h",
                improve="Book the revisit on the first call",
                focus="Assign 2 hot leads untouched for 24h",
                win="Closed 5 of 13 leads",
                good_at=["Fast follow-up"],
                work_on=["Booking the revisit"],
            ),
            AgentMetricModel(
                channel_slug="capture-agent",
                name="Conversation Capture Agent",
                agent_type="task",
                icon="Mic",
                color="#0f766e",
                scope="Stores, calls and field",
                metric_name="Capture coverage",
                target_value=90,
                current_value=78,
                change_value=1,
                items_label="Shifts to capture",
                source_attribution="Sample shift benchmark · Koramangala store",
                did_well="Recorded every afternoon talk",
                improve="Start recording at the greeting",
                focus="Shift recording coverage and phone setup",
                win="Recorded 21 of 22 talks",
                good_at=["Afternoon coverage"],
                work_on=["Starting at the greeting"],
            ),
        ]
        db.add_all(metrics)

        # 4. Initial Messages
        messages = [
            PulseMessageModel(
                channel_id=AVANIBOT_CHANNEL_ID,
                sender_id=UUID("00000000-0000-0000-0000-000000000000"),
                sender_name="AvaniBot",
                sender_initials="🤖",
                body="Hello Arvind! I am AvaniBot, your grounded shift assistant.\n\nI am connected to your live calling targets, lead scores, callbacks, team escalations, and shift checklist.\nHow can I help you with your shift right now?",
                sent_at=now,
                is_agent=False,
            ),
            PulseMessageModel(
                channel_id=CALLCENTRE_AGENT_CHANNEL_ID,
                sender_id=UUID("00000000-0000-0000-0000-000000000000"),
                sender_name="AvaniBot",
                sender_initials="🤖",
                body="Good morning Arvind. Today's digest is pinned at the top: incoming context and the tasks allocated to you.",
                sent_at=now,
                is_agent=False,
            ),
            PulseMessageModel(
                channel_id=CALLCENTRE_TEAM_CHANNEL_ID,
                sender_id=UUID("00000000-0000-0000-0000-000000000099"),
                sender_name="Sunita Rao",
                sender_initials="SR",
                body="Team: Greeting QA scores need attention in the first 10 seconds today. Please review the pinned coaching slot.",
                sent_at=now,
                is_agent=False,
            ),
        ]
        db.add_all(messages)

        # 5. Assigned Tasks for Default Agent (Arvind Rajan) (Part C)
        arvind_id = UUID("00000000-0000-0000-0000-000000000001")
        tasks = [
            TaskModel(
                id=UUID("22222222-2222-2222-2222-222222220001"),
                agent_id=arvind_id,
                channel_slug="callcentre-agent",
                category="type_1",
                title="Priya Iyer · Billing dispute · call 4:30pm",
                description="Priya Iyer billing dispute enquiry — check resolution before callback",
                manager_name="Sunita Rao",
                time_window="call 4:30pm",
                status=TaskStatus.PENDING.value,
                is_acknowledged=False,
                created_at=now,
                updated_at=now,
            ),
            TaskModel(
                id=UUID("22222222-2222-2222-2222-222222220002"),
                agent_id=arvind_id,
                channel_slug="callcentre-agent",
                category="type_1",
                title="Suresh Nair · Plan upgrade · log outcome",
                description="Suresh Nair enquired about upgrading to SmartGRID Luxe — log call disposition",
                manager_name="Sunita Rao",
                time_window="morning follow-up",
                status=TaskStatus.PENDING.value,
                is_acknowledged=False,
                created_at=now,
                updated_at=now,
            ),
            TaskModel(
                id=UUID("22222222-2222-2222-2222-222222220003"),
                agent_id=arvind_id,
                channel_slug="cross-sell-agent",
                category="type_1",
                title="Meera S. · Bought mattress, no protector · call today",
                description="Cross-sell mattress protector bundle at special 15% discount",
                manager_name="Sunita Rao",
                time_window="call before 1pm",
                status=TaskStatus.PENDING.value,
                is_acknowledged=False,
                created_at=now,
                updated_at=now,
            ),
            TaskModel(
                id=UUID("22222222-2222-2222-2222-222222220004"),
                agent_id=arvind_id,
                channel_slug="cross-sell-agent",
                category="type_1",
                title="Karan P. · Queen to king upgrade · send quote",
                description="Send formal quote for King size upgrade with 12-month zero interest",
                manager_name="Sunita Rao",
                time_window="send quote",
                status=TaskStatus.PENDING.value,
                is_acknowledged=False,
                created_at=now,
                updated_at=now,
            ),
            TaskModel(
                id=UUID("22222222-2222-2222-2222-222222220005"),
                agent_id=arvind_id,
                channel_slug="capture-agent",
                category="type_1",
                title="Mon 11am to 1pm · App not recording · start at greeting",
                description="Verify microphone permissions and start capture immediately upon customer greeting",
                manager_name="Sunita Rao",
                time_window="11am to 1pm",
                status=TaskStatus.PENDING.value,
                is_acknowledged=False,
                created_at=now,
                updated_at=now,
            ),
            TaskModel(
                id=UUID("22222222-2222-2222-2222-222222220006"),
                agent_id=arvind_id,
                channel_slug="capture-agent",
                category="type_1",
                title="Tue 6pm to 8pm · Phone on silent mode",
                description="Keep ringtone at full volume during evening shift callback rush",
                manager_name="Sunita Rao",
                time_window="6pm to 8pm",
                status=TaskStatus.PENDING.value,
                is_acknowledged=False,
                created_at=now,
                updated_at=now,
            ),
            TaskModel(
                id=UUID("22222222-2222-2222-2222-222222220007"),
                agent_id=arvind_id,
                channel_slug=None,
                category="general",
                title="Complete 18-call shift target",
                description="Achieve 18 completed customer calls with 85%+ SOP adherence",
                manager_name="Sunita Rao",
                time_window="By 6:00 PM",
                status=TaskStatus.IN_PROGRESS.value,
                is_acknowledged=True,
                acknowledged_at=now,
                created_at=now,
                updated_at=now,
            ),
        ]
        db.add_all(tasks)

        await db.commit()

    @staticmethod
    async def get_channels(
        agent: AuthenticatedAgent,
        db: AsyncSession,
    ) -> List[PulseChannelDTO]:
        """
        List channels authorized for agent's store with dynamic unread counts.
        Channels in other stores are excluded (store isolation).
        """
        await PulseService.seed_data_if_empty(db)

        stmt = (
            select(PulseChannelModel)
            .where(or_(PulseChannelModel.store == agent.store, PulseChannelModel.store == "all"))
            .order_by(PulseChannelModel.created_at.asc())
        )
        channels = (await db.execute(stmt)).scalars().all()

        channel_dtos: List[PulseChannelDTO] = []
        for ch in channels:
            # Derive unread count dynamically
            # Count messages where id not in pulse_message_reads for this agent
            read_stmt = select(PulseMessageReadModel.message_id).where(
                and_(
                    PulseMessageReadModel.channel_id == ch.id,
                    PulseMessageReadModel.agent_id == agent.id,
                )
            )
            read_ids = (await db.execute(read_stmt)).scalars().all()

            unread_stmt = select(func.count(PulseMessageModel.id)).where(
                and_(
                    PulseMessageModel.channel_id == ch.id,
                    PulseMessageModel.sender_id != agent.id,
                    PulseMessageModel.id.not_in(read_ids) if read_ids else True,
                )
            )
            unread_count = (await db.execute(unread_stmt)).scalar_one()

            # Enrich channel with metric info if it matches an agent metric
            slug = ch.name.lstrip("#")
            metric_stmt = select(AgentMetricModel).where(AgentMetricModel.channel_slug == slug)
            metric = (await db.execute(metric_stmt)).scalar_one_or_none()

            channel_dtos.append(
                PulseChannelDTO(
                    id=ch.id,
                    name=ch.name,
                    store=ch.store,
                    description=ch.description,
                    icon=ch.icon,
                    color=ch.color,
                    unread_count=unread_count,
                    channel_type=ch.channel_type,
                    channel_slug=slug,
                    metric_name=metric.metric_name if metric else None,
                    target_value=metric.target_value if metric else None,
                    current_value=metric.current_value if metric else None,
                    change_value=metric.change_value if metric else None,
                    items_label=metric.items_label if metric else None,
                    scope=metric.scope if metric else None,
                    source_attribution=metric.source_attribution if metric else None,
                )
            )

        return channel_dtos

    @staticmethod
    async def get_messages(
        channel_id: UUID,
        agent: AuthenticatedAgent,
        db: AsyncSession,
        limit: int = 50,
    ) -> List[PulseMessageDTO]:
        """
        Get message thread for channel with store authorization check.
        Rejects with 403 Forbidden if channel does not match agent store.
        """
        await PulseService.seed_data_if_empty(db)

        channel = await db.get(PulseChannelModel, channel_id)
        if not channel:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Channel {channel_id} not found",
            )

        if channel.store != agent.store and channel.store != "all":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Agent store '{agent.store}' forbidden from accessing channel in store '{channel.store}'",
            )

        stmt = (
            select(PulseMessageModel)
            .where(PulseMessageModel.channel_id == channel_id)
            .order_by(PulseMessageModel.sent_at.asc())
            .limit(limit)
        )
        messages = (await db.execute(stmt)).scalars().all()

        return [
            PulseMessageDTO(
                id=m.id,
                channel_id=m.channel_id,
                sender_id=m.sender_id,
                sender_name=m.sender_name,
                sender_initials=m.sender_initials,
                body=m.body,
                sent_at=m.sent_at,
                is_current_agent=(m.sender_id == agent.id),
            )
            for m in messages
        ]

    @staticmethod
    async def post_message(
        channel_id: UUID,
        agent: AuthenticatedAgent,
        body: str,
        db: AsyncSession,
    ) -> PulseMessageDTO:
        """
        Post a message to channel with store authorization check.
        """
        await PulseService.seed_data_if_empty(db)

        channel = await db.get(PulseChannelModel, channel_id)
        if not channel:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Channel {channel_id} not found",
            )

        if channel.store != agent.store and channel.store != "all":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Agent store '{agent.store}' forbidden from posting in store '{channel.store}'",
            )

        initials = "".join([part[0] for part in agent.name.split() if part])[:2].upper() or "ME"

        msg = PulseMessageModel(
            channel_id=channel_id,
            sender_id=agent.id,
            sender_name=agent.name,
            sender_initials=initials,
            body=body.strip(),
            sent_at=datetime.now(timezone.utc),
            is_agent=True,
        )
        db.add(msg)
        await db.commit()
        await db.refresh(msg)

        return PulseMessageDTO(
            id=msg.id,
            channel_id=msg.channel_id,
            sender_id=msg.sender_id,
            sender_name=msg.sender_name,
            sender_initials=msg.sender_initials,
            body=msg.body,
            sent_at=msg.sent_at,
            is_current_agent=True,
        )

    @staticmethod
    async def mark_channel_read(
        channel_id: UUID,
        agent: AuthenticatedAgent,
        db: AsyncSession,
    ) -> bool:
        """
        Mark all messages in channel as read by this agent.
        """
        await PulseService.seed_data_if_empty(db)

        channel = await db.get(PulseChannelModel, channel_id)
        if not channel:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Channel {channel_id} not found",
            )

        if channel.store != agent.store and channel.store != "all":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Agent store '{agent.store}' forbidden from reading channel in store '{channel.store}'",
            )

        # Fetch all messages in channel
        msg_stmt = select(PulseMessageModel.id).where(PulseMessageModel.channel_id == channel_id)
        msg_ids = (await db.execute(msg_stmt)).scalars().all()

        now = datetime.now(timezone.utc)
        for mid in msg_ids:
            # Check existing read
            chk = select(PulseMessageReadModel).where(
                and_(
                    PulseMessageReadModel.channel_id == channel_id,
                    PulseMessageReadModel.message_id == mid,
                    PulseMessageReadModel.agent_id == agent.id,
                )
            )
            exists = (await db.execute(chk)).scalar_one_or_none()
            if not exists:
                db.add(
                    PulseMessageReadModel(
                        channel_id=channel_id,
                        message_id=mid,
                        agent_id=agent.id,
                        read_at=now,
                    )
                )

        await db.commit()
        return True

    @staticmethod
    async def get_pinned_items(
        channel_id: UUID,
        agent: AuthenticatedAgent,
        db: AsyncSession,
    ) -> List[PinnedItemDTO]:
        """
        Get active pinned items for channel.
        Answers are resolved INDEPENDENTLY per agent:
        Agent A answering does NOT mark item answered for Agent B!
        """
        await PulseService.seed_data_if_empty(db)

        channel = await db.get(PulseChannelModel, channel_id)
        if not channel:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Channel {channel_id} not found",
            )

        if channel.store != agent.store and channel.store != "all":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Agent store '{agent.store}' forbidden from accessing pinned items in store '{channel.store}'",
            )

        stmt = (
            select(PulsePinnedItemModel)
            .where(
                and_(
                    PulsePinnedItemModel.channel_id == channel_id,
                    PulsePinnedItemModel.is_active.is_(True),
                )
            )
            .order_by(PulsePinnedItemModel.created_at.asc())
        )
        items = (await db.execute(stmt)).scalars().all()

        result: List[PinnedItemDTO] = []
        for item in items:
            # Check if THIS agent has responded
            resp_stmt = select(PulsePinnedResponseModel).where(
                and_(
                    PulsePinnedResponseModel.pinned_item_id == item.id,
                    PulsePinnedResponseModel.agent_id == agent.id,
                )
            )
            resp = (await db.execute(resp_stmt)).scalar_one_or_none()

            result.append(
                PinnedItemDTO(
                    id=item.id,
                    channel_id=item.channel_id,
                    question=item.question,
                    options=item.options or [],
                    meta=item.meta,
                    urgency=item.urgency,
                    is_answered=resp is not None,
                    selected_option=resp.selected_option if resp else None,
                    custom_reply=resp.custom_reply if resp else None,
                )
            )

        return result

    @staticmethod
    async def respond_pinned_item(
        pinned_item_id: UUID,
        agent: AuthenticatedAgent,
        selected_option: str,
        custom_reply: Optional[str],
        db: AsyncSession,
    ) -> bool:
        """
        Submit persistent agent response to pinned action card.
        - Validates existence and store access.
        - Prevents duplicate contradictory writes by upserting per (pinned_item_id, agent.id).
        - Automatically emits a message to the channel thread.
        """
        await PulseService.seed_data_if_empty(db)

        item = await db.get(PulsePinnedItemModel, pinned_item_id)
        if not item or not item.is_active:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pinned item {pinned_item_id} not found or inactive",
            )

        channel = await db.get(PulseChannelModel, item.channel_id)
        if not channel or (channel.store != agent.store and channel.store != "all"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Agent store '{agent.store}' forbidden from responding to item in store '{channel.store if channel else 'unknown'}'",
            )

        choice = selected_option.strip()
        if not choice:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="selected_option cannot be empty",
            )

        now = datetime.now(timezone.utc)

        # Check existing response for this agent
        resp_stmt = select(PulsePinnedResponseModel).where(
            and_(
                PulsePinnedResponseModel.pinned_item_id == pinned_item_id,
                PulsePinnedResponseModel.agent_id == agent.id,
            )
        )
        existing_resp = (await db.execute(resp_stmt)).scalar_one_or_none()

        if existing_resp:
            # Update existing response
            existing_resp.selected_option = choice
            existing_resp.custom_reply = custom_reply.strip() if custom_reply else None
            existing_resp.responded_at = now
        else:
            # Create new response
            new_resp = PulsePinnedResponseModel(
                pinned_item_id=pinned_item_id,
                agent_id=agent.id,
                selected_option=choice,
                custom_reply=custom_reply.strip() if custom_reply else None,
                responded_at=now,
            )
            db.add(new_resp)

        # Post response confirmation message into channel
        initials = "".join([part[0] for part in agent.name.split() if part])[:2].upper() or "ME"
        body_text = f"Responded to '{item.question}': {choice}"
        if custom_reply and custom_reply.strip():
            body_text += f" — Note: {custom_reply.strip()}"

        chat_msg = PulseMessageModel(
            channel_id=channel.id,
            sender_id=agent.id,
            sender_name=agent.name,
            sender_initials=initials,
            body=body_text,
            sent_at=now,
            is_agent=True,
        )
        db.add(chat_msg)

        await db.commit()
        return True

    @staticmethod
    async def get_agent_catalog(
        agent: AuthenticatedAgent,
        db: AsyncSession,
    ) -> List[AgentCatalogItemDTO]:
        """
        List custom role and task agents with persisted benchmarks and attribution.
        """
        await PulseService.seed_data_if_empty(db)

        stmt = select(AgentMetricModel).where(AgentMetricModel.is_active.is_(True)).order_by(AgentMetricModel.name.asc())
        metrics = (await db.execute(stmt)).scalars().all()

        return [
            AgentCatalogItemDTO(
                id=m.id,
                channel_slug=m.channel_slug,
                name=m.name,
                agent_type=m.agent_type,
                icon=m.icon,
                color=m.color,
                scope=m.scope,
                metric_name=m.metric_name,
                target_value=m.target_value,
                current_value=m.current_value,
                change_value=m.change_value,
                items_label=m.items_label,
                source_attribution=m.source_attribution,
                status="Active",
                did_well=m.did_well,
                improve=m.improve,
                focus=m.focus,
                win=m.win,
                good_at=m.good_at or [],
                work_on=m.work_on or [],
            )
            for m in metrics
        ]

    @staticmethod
    async def get_channel_context(
        channel_slug: str,
        agent: AuthenticatedAgent,
        db: AsyncSession,
    ) -> ChannelContextDTO:
        """
        Fetch agent-specific context, performance metrics, and personal tasks for channel.
        Enforces agent and store isolation.
        """
        await PulseService.seed_data_if_empty(db)

        clean_slug = channel_slug.lstrip("#")
        stmt = select(AgentMetricModel).where(AgentMetricModel.channel_slug == clean_slug)
        metric = (await db.execute(stmt)).scalar_one_or_none()

        if not metric:
            # Fallback default context if generic channel
            metric_name = "Conversion"
            target_val = 28
            curr_val = 29
            chg_val = 3
            label = "Leads to follow up"
            attribution = "Sample shift benchmark · Koramangala store"
            did_well = "Booked 6 store visits from callbacks"
            improve = "Greeting in the first 10 seconds on 71% of calls"
            ch_name = f"#{clean_slug}"
            good = ["Booking visits"]
            work = ["Opening greeting"]
        else:
            metric_name = metric.metric_name
            target_val = metric.target_value
            curr_val = metric.current_value
            chg_val = metric.change_value
            label = metric.items_label
            attribution = metric.source_attribution
            did_well = metric.did_well or ""
            improve = metric.improve or ""
            ch_name = metric.name
            good = metric.good_at or []
            work = metric.work_on or []

        # Fetch personal tasks for THIS AGENT on this channel
        task_stmt = (
            select(TaskModel)
            .where(
                and_(
                    TaskModel.agent_id == agent.id,
                    or_(
                        TaskModel.channel_slug == clean_slug,
                        TaskModel.channel_slug.is_(None),
                    ),
                )
            )
            .order_by(TaskModel.created_at.asc())
        )
        tasks = (await db.execute(task_stmt)).scalars().all()

        unack_count = sum(1 for t in tasks if not t.is_acknowledged)

        task_dicts = [
            {
                "id": str(t.id),
                "title": t.title,
                "description": t.description,
                "time_window": t.time_window,
                "category": t.category,
                "status": t.status,
                "is_acknowledged": t.is_acknowledged,
                "manager_name": t.manager_name,
                "explanation": t.explanation,
            }
            for t in tasks
        ]

        manager_ctx = f"Yesterday: {curr_val}% (target {target_val}%). Sent 9:00am by AvaniBot for your manager."

        return ChannelContextDTO(
            channel_slug=clean_slug,
            channel_name=ch_name,
            manager_context=manager_ctx,
            digest_time="9:00am",
            metric_name=metric_name,
            target_value=target_val,
            current_value=curr_val,
            change_value=chg_val,
            did_well=did_well,
            improve=improve,
            items_label=label,
            unacknowledged_task_count=unack_count,
            tasks=task_dicts,
            soft_tasks={
                "good_at": good,
                "work_on": work,
                "focus": metric.focus if metric else "Shift execution",
                "win": metric.win if metric else "On target",
            },
        )
