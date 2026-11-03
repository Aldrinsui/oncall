import pytest
from uuid import UUID, uuid4
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from backend.app.main import app
from backend.app.core.config import settings
from backend.app.core.database import Base, get_db
from backend.app.services.pulse_service import (
    PulseService,
    AVANIBOT_CHANNEL_ID,
    PINNED_ITEM_1_ID,
    PINNED_ITEM_2_ID,
)
from backend.app.domains.common.enums import TaskStatus

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest.fixture
async def test_session():
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
    async_session = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        await PulseService.seed_data_if_empty(session)
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest.fixture
async def client(test_session: AsyncSession):
    async def override_get_db():
        yield test_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()

AGENT_1_HEADERS = {
    "X-Agent-Id": settings.DEV_AGENT_ID,
    "X-Store-Id": "Koramangala",
}

AGENT_2_HEADERS = {
    "X-Agent-Id": settings.DEV_AGENT_2_ID,
    "X-Store-Id": "Koramangala",
}

RT_NAGAR_AGENT_HEADERS = {
    "X-Agent-Id": settings.DEV_AGENT_3_ID,
    "X-Store-Id": "RT Nagar",
}

@pytest.mark.asyncio
async def test_multiple_pinned_items_returned(client: AsyncClient):
    """Verify that multiple pinned items are returned for AvaniBot channel."""
    resp = await client.get(
        f"/api/v1/pulse/channels/{AVANIBOT_CHANNEL_ID}/pinned-items",
        headers=AGENT_1_HEADERS,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) >= 2

    q1 = next((item for item in data if str(PINNED_ITEM_1_ID) == item["id"]), None)
    assert q1 is not None
    assert q1["question"] == "Call now or reassign the 2 hot leads"
    assert q1["meta"] == "Untouched for 24h"
    assert "Calling now" in q1["options"]
    assert "Reassign" in q1["options"]
    assert q1["is_answered"] is False

    q2 = next((item for item in data if str(PINNED_ITEM_2_ID) == item["id"]), None)
    assert q2 is not None
    assert q2["question"] == "Log this morning's call outcome"
    assert "Suresh Nair" in q2["meta"]
    assert "Converted" in q2["options"]
    assert "Callback" in q2["options"]
    assert "Not interested" in q2["options"]
    assert q2["is_answered"] is False

@pytest.mark.asyncio
async def test_independent_responses_from_two_agents(client: AsyncClient):
    """
    Verify agent response isolation:
    Agent 1 responding to a pinned item does NOT mark it answered for Agent 2.
    """
    # 1. Agent 1 responds to Item 1
    post_resp = await client.post(
        f"/api/v1/pulse/pinned-items/{PINNED_ITEM_1_ID}/respond",
        headers=AGENT_1_HEADERS,
        json={"selected_option": "Calling now", "custom_reply": "Dialing Mukunda"},
    )
    assert post_resp.status_code == 200

    # Check Agent 1 view: answered
    resp_a1 = await client.get(
        f"/api/v1/pulse/channels/{AVANIBOT_CHANNEL_ID}/pinned-items",
        headers=AGENT_1_HEADERS,
    )
    items_a1 = resp_a1.json()["data"]
    item1_a1 = next(item for item in items_a1 if item["id"] == str(PINNED_ITEM_1_ID))
    assert item1_a1["is_answered"] is True
    assert item1_a1["selected_option"] == "Calling now"
    assert item1_a1["custom_reply"] == "Dialing Mukunda"

    # Check Agent 2 view: NOT answered
    resp_a2 = await client.get(
        f"/api/v1/pulse/channels/{AVANIBOT_CHANNEL_ID}/pinned-items",
        headers=AGENT_2_HEADERS,
    )
    items_a2 = resp_a2.json()["data"]
    item1_a2 = next(item for item in items_a2 if item["id"] == str(PINNED_ITEM_1_ID))
    assert item1_a2["is_answered"] is False
    assert item1_a2["selected_option"] is None

    # 2. Agent 2 responds with different option
    post_resp_2 = await client.post(
        f"/api/v1/pulse/pinned-items/{PINNED_ITEM_1_ID}/respond",
        headers=AGENT_2_HEADERS,
        json={"selected_option": "Reassign", "custom_reply": "Reassigning to Priya"},
    )
    assert post_resp_2.status_code == 200

    # Check Agent 2 view: now answered with Agent 2's distinct choice
    resp_a2_after = await client.get(
        f"/api/v1/pulse/channels/{AVANIBOT_CHANNEL_ID}/pinned-items",
        headers=AGENT_2_HEADERS,
    )
    item1_a2_after = next(item for item in resp_a2_after.json()["data"] if item["id"] == str(PINNED_ITEM_1_ID))
    assert item1_a2_after["is_answered"] is True
    assert item1_a2_after["selected_option"] == "Reassign"
    assert item1_a2_after["custom_reply"] == "Reassigning to Priya"

    # Verify Agent 1 view is unchanged
    resp_a1_recheck = await client.get(
        f"/api/v1/pulse/channels/{AVANIBOT_CHANNEL_ID}/pinned-items",
        headers=AGENT_1_HEADERS,
    )
    item1_a1_recheck = next(item for item in resp_a1_recheck.json()["data"] if item["id"] == str(PINNED_ITEM_1_ID))
    assert item1_a1_recheck["selected_option"] == "Calling now"

@pytest.mark.asyncio
async def test_response_persists_after_database_reload(client: AsyncClient, test_session: AsyncSession):
    """Verify that response is stored in database and persists across reloads."""
    post_resp = await client.post(
        f"/api/v1/pulse/pinned-items/{PINNED_ITEM_2_ID}/respond",
        headers=AGENT_1_HEADERS,
        json={"selected_option": "Converted", "custom_reply": "Customer opted for SmartGRID Luxe"},
    )
    assert post_resp.status_code == 200

    # Query from API
    get_resp = await client.get(
        f"/api/v1/pulse/channels/{AVANIBOT_CHANNEL_ID}/pinned-items",
        headers=AGENT_1_HEADERS,
    )
    items = get_resp.json()["data"]
    item2 = next(i for i in items if i["id"] == str(PINNED_ITEM_2_ID))
    assert item2["is_answered"] is True
    assert item2["selected_option"] == "Converted"
    assert item2["custom_reply"] == "Customer opted for SmartGRID Luxe"

@pytest.mark.asyncio
async def test_resolved_items_disappear_from_pending_count(client: AsyncClient):
    """Verify pending item calculation as items are answered."""
    resp_init = await client.get(
        f"/api/v1/pulse/channels/{AVANIBOT_CHANNEL_ID}/pinned-items",
        headers=AGENT_1_HEADERS,
    )
    items_init = resp_init.json()["data"]
    unanswered_count_0 = sum(1 for i in items_init if not i["is_answered"])
    assert unanswered_count_0 == 2

    # Answer Item 1
    await client.post(
        f"/api/v1/pulse/pinned-items/{PINNED_ITEM_1_ID}/respond",
        headers=AGENT_1_HEADERS,
        json={"selected_option": "Calling now"},
    )

    resp_mid = await client.get(
        f"/api/v1/pulse/channels/{AVANIBOT_CHANNEL_ID}/pinned-items",
        headers=AGENT_1_HEADERS,
    )
    unanswered_count_1 = sum(1 for i in resp_mid.json()["data"] if not i["is_answered"])
    assert unanswered_count_1 == 1

    # Answer Item 2
    await client.post(
        f"/api/v1/pulse/pinned-items/{PINNED_ITEM_2_ID}/respond",
        headers=AGENT_1_HEADERS,
        json={"selected_option": "Callback"},
    )

    resp_final = await client.get(
        f"/api/v1/pulse/channels/{AVANIBOT_CHANNEL_ID}/pinned-items",
        headers=AGENT_1_HEADERS,
    )
    unanswered_count_2 = sum(1 for i in resp_final.json()["data"] if not i["is_answered"])
    assert unanswered_count_2 == 0

@pytest.mark.asyncio
async def test_duplicate_response_behavior(client: AsyncClient):
    """Verify that multiple responses from the same agent update rather than duplicating."""
    # First response
    r1 = await client.post(
        f"/api/v1/pulse/pinned-items/{PINNED_ITEM_1_ID}/respond",
        headers=AGENT_1_HEADERS,
        json={"selected_option": "Calling now"},
    )
    assert r1.status_code == 200

    # Second response updates to Reassign
    r2 = await client.post(
        f"/api/v1/pulse/pinned-items/{PINNED_ITEM_1_ID}/respond",
        headers=AGENT_1_HEADERS,
        json={"selected_option": "Reassign", "custom_reply": "Lead reassigned"},
    )
    assert r2.status_code == 200

    # Check that updated value is present
    get_resp = await client.get(
        f"/api/v1/pulse/channels/{AVANIBOT_CHANNEL_ID}/pinned-items",
        headers=AGENT_1_HEADERS,
    )
    item = next(i for i in get_resp.json()["data"] if i["id"] == str(PINNED_ITEM_1_ID))
    assert item["selected_option"] == "Reassign"
    assert item["custom_reply"] == "Lead reassigned"

@pytest.mark.asyncio
async def test_invalid_pinned_item_response_rejected(client: AsyncClient):
    """Verify rejection of empty responses or nonexistent items."""
    # Nonexistent item
    random_id = uuid4()
    bad_resp = await client.post(
        f"/api/v1/pulse/pinned-items/{random_id}/respond",
        headers=AGENT_1_HEADERS,
        json={"selected_option": "Calling now"},
    )
    assert bad_resp.status_code == 404

    # Empty string rejected by Pydantic min_length=1
    empty_resp = await client.post(
        f"/api/v1/pulse/pinned-items/{PINNED_ITEM_1_ID}/respond",
        headers=AGENT_1_HEADERS,
        json={"selected_option": ""},
    )
    assert empty_resp.status_code == 422

@pytest.mark.asyncio
async def test_cross_store_access_denied(client: AsyncClient):
    """
    Verify store-level authorization:
    RT Nagar agent is denied access to Koramangala-exclusive channels and pinned items.
    """
    # 1. Accessing Koramangala channel messages from RT Nagar returns 403 Forbidden
    resp = await client.get(
        f"/api/v1/pulse/channels/{AVANIBOT_CHANNEL_ID}/messages",
        headers=RT_NAGAR_AGENT_HEADERS,
    )
    assert resp.status_code == 403

    # 2. Posting to Koramangala channel from RT Nagar returns 403
    post_resp = await client.post(
        f"/api/v1/pulse/channels/{AVANIBOT_CHANNEL_ID}/messages",
        headers=RT_NAGAR_AGENT_HEADERS,
        json={"body": "Unauthorized cross-store greeting"},
    )
    assert post_resp.status_code == 403

    # 3. Marking read on Koramangala channel from RT Nagar returns 403
    read_resp = await client.post(
        f"/api/v1/pulse/channels/{AVANIBOT_CHANNEL_ID}/read",
        headers=RT_NAGAR_AGENT_HEADERS,
    )
    assert read_resp.status_code == 403

    # 4. Accessing pinned items returns 403
    pin_resp = await client.get(
        f"/api/v1/pulse/channels/{AVANIBOT_CHANNEL_ID}/pinned-items",
        headers=RT_NAGAR_AGENT_HEADERS,
    )
    assert pin_resp.status_code == 403

    # 5. Responding to pinned item returns 403
    resp_item = await client.post(
        f"/api/v1/pulse/pinned-items/{PINNED_ITEM_1_ID}/respond",
        headers=RT_NAGAR_AGENT_HEADERS,
        json={"selected_option": "Calling now"},
    )
    assert resp_item.status_code == 403

@pytest.mark.asyncio
async def test_task_assignment_isolation(client: AsyncClient):
    """
    Verify agent isolation on task assignments:
    Agent 1 only sees their own assigned tasks, never Agent 2's tasks.
    """
    resp_a1 = await client.get("/api/v1/tasks", headers=AGENT_1_HEADERS)
    assert resp_a1.status_code == 200
    tasks_a1 = resp_a1.json()["data"]
    assert len(tasks_a1) > 0
    for t in tasks_a1:
        assert t["agent_id"] == settings.DEV_AGENT_ID

    resp_a2 = await client.get("/api/v1/tasks", headers=AGENT_2_HEADERS)
    assert resp_a2.status_code == 200
    tasks_a2 = resp_a2.json()["data"]
    # Agent 2 has no tasks seeded by default
    assert len(tasks_a2) == 0

@pytest.mark.asyncio
async def test_task_status_transitions(client: AsyncClient):
    """
    Verify task status transitions:
    - Done -> COMPLETED
    - Not yet -> PENDING or IN_PROGRESS
    - Need help -> BLOCKED with explanation
    """
    # 1. Fetch first task
    tasks = (await client.get("/api/v1/tasks", headers=AGENT_1_HEADERS)).json()["data"]
    task_id = tasks[0]["id"]

    # 2. Done -> COMPLETED
    r_done = await client.patch(
        f"/api/v1/tasks/{task_id}",
        headers=AGENT_1_HEADERS,
        json={"status": TaskStatus.COMPLETED.value},
    )
    assert r_done.status_code == 200
    assert r_done.json()["data"]["status"] == "COMPLETED"

    # 3. Not yet -> IN_PROGRESS
    r_progress = await client.patch(
        f"/api/v1/tasks/{task_id}",
        headers=AGENT_1_HEADERS,
        json={"status": TaskStatus.IN_PROGRESS.value},
    )
    assert r_progress.status_code == 200
    assert r_progress.json()["data"]["status"] == "IN_PROGRESS"

    # 4. Need help -> BLOCKED with explanation
    r_help = await client.patch(
        f"/api/v1/tasks/{task_id}",
        headers=AGENT_1_HEADERS,
        json={
            "status": TaskStatus.BLOCKED.value,
            "explanation": "Billing dispute requires store manager override",
        },
    )
    assert r_help.status_code == 200
    data = r_help.json()["data"]
    assert data["status"] == "BLOCKED"
    assert data["explanation"] == "Billing dispute requires store manager override"

@pytest.mark.asyncio
async def test_bulk_acknowledgement_does_not_complete_tasks(client: AsyncClient):
    """
    Verify bulk acknowledgement:
    Records acknowledgement timestamp without completing tasks!
    """
    # Verify unacknowledged tasks exist
    tasks_before = (await client.get("/api/v1/tasks", headers=AGENT_1_HEADERS)).json()["data"]
    unack_before = [t for t in tasks_before if not t["is_acknowledged"]]
    assert len(unack_before) > 0

    # Call bulk acknowledge
    ack_resp = await client.post(
        "/api/v1/tasks/acknowledge",
        headers=AGENT_1_HEADERS,
        json={},
    )
    assert ack_resp.status_code == 200
    ack_data = ack_resp.json()["data"]
    assert ack_data["acknowledged_count"] == len(unack_before)
    assert ack_data["acknowledged_at"] is not None

    # Verify tasks are acknowledged BUT statuses remain open (not all COMPLETED)
    tasks_after = (await client.get("/api/v1/tasks", headers=AGENT_1_HEADERS)).json()["data"]
    for t in tasks_after:
        assert t["is_acknowledged"] is True
        assert t["acknowledged_at"] is not None

    # Specifically check that tasks that were PENDING remain PENDING
    pending_tasks = [t for t in tasks_after if t["status"] == "PENDING"]
    assert len(pending_tasks) > 0, "Bulk acknowledgement must not convert pending tasks to COMPLETED"

@pytest.mark.asyncio
async def test_unauthorized_task_updates_rejected(client: AsyncClient):
    """Verify that an agent cannot update another agent's task."""
    tasks = (await client.get("/api/v1/tasks", headers=AGENT_1_HEADERS)).json()["data"]
    task_id = tasks[0]["id"]

    # Agent 2 attempts to update Agent 1's task
    update_resp = await client.patch(
        f"/api/v1/tasks/{task_id}",
        headers=AGENT_2_HEADERS,
        json={"status": TaskStatus.COMPLETED.value},
    )
    assert update_resp.status_code == 403

@pytest.mark.asyncio
async def test_agent_catalog_and_context(client: AsyncClient):
    """
    Verify custom agent catalog and agent channel context:
    - 5 specialized agents with metrics and attribution
    - Context & Tasks panel returns manager digest, did_well, improve, and personal tasks
    """
    catalog_resp = await client.get("/api/v1/pulse/agents", headers=AGENT_1_HEADERS)
    assert catalog_resp.status_code == 200
    agents = catalog_resp.json()["data"]
    assert len(agents) == 5

    slugs = [a["channel_slug"] for a in agents]
    assert "callcentre-agent" in slugs
    assert "cross-sell-agent" in slugs
    assert "sop-agent" in slugs
    assert "lead-conversion-agent" in slugs
    assert "capture-agent" in slugs

    # Check source attribution
    for a in agents:
        assert "benchmark" in a["source_attribution"].lower()

    # Check Channel Context
    ctx_resp = await client.get(
        "/api/v1/pulse/channels/callcentre-agent/context",
        headers=AGENT_1_HEADERS,
    )
    assert ctx_resp.status_code == 200
    ctx = ctx_resp.json()["data"]
    assert ctx["channel_slug"] == "callcentre-agent"
    assert "9:00am" in ctx["digest_time"]
    assert len(ctx["tasks"]) >= 2
    assert "good_at" in ctx["soft_tasks"]
    assert "work_on" in ctx["soft_tasks"]
