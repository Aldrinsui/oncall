import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timezone

from backend.app.main import app
from backend.app.core.config import settings
from backend.app.core.database import async_engine, Base, AsyncSessionLocal
from backend.app.domains.telephony.mock_provider import MockTelephonyProvider
from backend.app.domains.telephony.provider_factory import set_telephony_provider
from backend.app.domains.telephony.twilio_provider import TwilioTelephonyProvider
from backend.app.domains.common.enums import (
    CallStatus,
    CallLegStatus,
    CallEventType,
)
from backend.app.services.telephony_service import TelephonyService

@pytest.fixture(autouse=True)
async def setup_test_db():
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.fixture
def mock_provider():
    provider = MockTelephonyProvider()
    set_telephony_provider(provider)
    return provider

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

@pytest.mark.asyncio
async def test_valid_phone_number_call_initiation(client, mock_provider):
    """Verify outbound call successfully initiated with valid E.164 phone number."""
    payload = {
        "customer_phone": "+919876543210",
        "customer_name": "Rohan Sharma",
        "notes": "Interested in SmartGRID Luxe mattress",
    }
    headers = {"X-Dev-Agent-Id": settings.DEV_AGENT_ID}

    response = await client.post("/api/v1/calls", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()["data"]

    assert data["status"] == CallStatus.AGENT_RINGING.value
    assert len(data["legs"]) == 2
    cust_leg = next(l for l in data["legs"] if l["leg_role"] == "CUSTOMER")
    agent_leg = next(l for l in data["legs"] if l["leg_role"] == "AGENT")
    assert cust_leg["to_endpoint_uri"] == "+919876543210"
    assert cust_leg["telephony_leg_id"] is not None
    assert agent_leg["telephony_leg_id"] is not None
    assert len(mock_provider.dispatched_legs) == 2
    assert mock_provider.dispatched_legs[0].leg_role.value == "AGENT"
    assert mock_provider.dispatched_legs[1].leg_role.value == "CUSTOMER"

@pytest.mark.asyncio
async def test_invalid_phone_number_rejection(client):
    """Verify invalid phone numbers are rejected with 422 Unprocessable Entity."""
    headers = {"X-Dev-Agent-Id": settings.DEV_AGENT_ID}

    # Invalid non-E.164
    resp1 = await client.post("/api/v1/calls", json={"customer_phone": "9876543210"}, headers=headers)
    assert resp1.status_code == 422

    # Alpha characters
    resp2 = await client.post("/api/v1/calls", json={"customer_phone": "+abc12345"}, headers=headers)
    assert resp2.status_code == 422

    # Blank
    resp3 = await client.post("/api/v1/calls", json={"customer_phone": ""}, headers=headers)
    assert resp3.status_code == 422

@pytest.mark.asyncio
async def test_unauthorized_call_initiation(client, monkeypatch):
    """Verify unauthorized requests are rejected when dev bypass is disabled."""
    monkeypatch.setattr(settings, "DEV_AUTH_BYPASS_ENABLED", False)

    payload = {"customer_phone": "+919876543210"}
    response = await client.post("/api/v1/calls", json=payload)
    assert response.status_code == 401
    assert "Authentication required" in response.json()["detail"]

@pytest.mark.asyncio
async def test_provider_api_failure_handled(client, mock_provider):
    """Verify provider failure returns 502 Bad Gateway and records call as FAILED."""
    mock_provider.should_fail = True
    mock_provider.failure_message = "Carrier congestion error"

    payload = {"customer_phone": "+919876543210"}
    headers = {"X-Dev-Agent-Id": settings.DEV_AGENT_ID}

    response = await client.post("/api/v1/calls", json=payload, headers=headers)
    assert response.status_code == 502
    assert "Carrier congestion error" in response.json()["detail"]

    # Verify recent call recorded in database as FAILED
    list_resp = await client.get("/api/v1/calls", headers=headers)
    calls = list_resp.json()["data"]
    assert len(calls) == 1
    assert calls[0]["status"] == CallStatus.FAILED.value

@pytest.mark.asyncio
async def test_call_status_retrieval_by_id(client, mock_provider):
    """Verify GET /calls/{id} returns accurate persisted call state."""
    headers = {"X-Dev-Agent-Id": settings.DEV_AGENT_ID}

    create_resp = await client.post(
        "/api/v1/calls", json={"customer_phone": "+919876543210"}, headers=headers
    )
    call_id = create_resp.json()["data"]["id"]

    get_resp = await client.get(f"/api/v1/calls/{call_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["data"]["id"] == call_id

@pytest.mark.asyncio
async def test_call_termination_flow(client, mock_provider):
    """Verify POST /calls/{id}/terminate transitions state and terminates provider leg."""
    headers = {"X-Dev-Agent-Id": settings.DEV_AGENT_ID}

    create_resp = await client.post(
        "/api/v1/calls", json={"customer_phone": "+919876543210"}, headers=headers
    )
    call_id = create_resp.json()["data"]["id"]

    term_resp = await client.post(
        f"/api/v1/calls/{call_id}/terminate",
        json={"reason": "Customer busy"},
        headers=headers,
    )
    assert term_resp.status_code == 200
    assert term_resp.json()["data"]["status"] == CallStatus.CANCELLED.value
    assert len(mock_provider.terminated_legs) == 2

@pytest.mark.asyncio
async def test_webhook_processing_and_deduplication(client, mock_provider):
    """Verify webhook transitions call to CONNECTED only after both legs answer, and ignores duplicate event deliveries."""
    headers = {"X-Dev-Agent-Id": settings.DEV_AGENT_ID}

    create_resp = await client.post(
        "/api/v1/calls", json={"customer_phone": "+919876543210"}, headers=headers
    )
    call_data = create_resp.json()["data"]
    call_id = call_data["id"]
    agent_leg_id = next(l["telephony_leg_id"] for l in call_data["legs"] if l["leg_role"] == "AGENT")
    customer_leg_id = next(l["telephony_leg_id"] for l in call_data["legs"] if l["leg_role"] == "CUSTOMER")

    # 1. Agent leg connects first -> call transitions to CUSTOMER_RINGING
    await client.post(
        "/api/v1/telephony/webhooks/mock",
        json={
            "call_id": call_id,
            "telephony_leg_id": agent_leg_id,
            "event_type": "CALL_CONNECTED",
            "provider_event_id": "evt-agent-conn",
        },
    )
    chk1 = await client.get(f"/api/v1/calls/{call_id}", headers=headers)
    assert chk1.json()["data"]["status"] == CallStatus.CUSTOMER_RINGING.value

    # 2. Customer leg connects second -> both legs answered -> call transitions to CONNECTED
    webhook_payload = {
        "call_id": call_id,
        "telephony_leg_id": customer_leg_id,
        "event_type": "CALL_CONNECTED",
        "provider_event_id": "evt-cust-conn",
    }
    wh_resp1 = await client.post("/api/v1/telephony/webhooks/mock", json=webhook_payload)
    assert wh_resp1.status_code == 200

    # Verify status is now CONNECTED and provider bridge was called
    get_resp1 = await client.get(f"/api/v1/calls/{call_id}", headers=headers)
    assert get_resp1.json()["data"]["status"] == CallStatus.CONNECTED.value
    assert len(mock_provider.bridged_legs) == 1
    assert mock_provider.bridged_legs[0]["call_id"] == call_id

    # 3. Resend duplicate webhook event
    wh_resp2 = await client.post("/api/v1/telephony/webhooks/mock", json=webhook_payload)
    assert wh_resp2.status_code == 200
    assert "Duplicate event ignored" in wh_resp2.json()["message"]

@pytest.mark.asyncio
async def test_webhook_busy_and_no_answer_outcomes(client, mock_provider):
    """Verify provider busy and no-answer webhooks update status accurately."""
    headers = {"X-Dev-Agent-Id": settings.DEV_AGENT_ID}

    # Busy outcome
    c1 = await client.post("/api/v1/calls", json={"customer_phone": "+919876543210"}, headers=headers)
    leg1 = next(l["telephony_leg_id"] for l in c1.json()["data"]["legs"] if l["leg_role"] == "CUSTOMER")
    id1 = c1.json()["data"]["id"]

    await client.post(
        "/api/v1/telephony/webhooks/mock",
        json={"telephony_leg_id": leg1, "event_type": "LEG_BUSY", "provider_event_id": "busy-1"},
    )
    chk1 = await client.get(f"/api/v1/calls/{id1}", headers=headers)
    assert chk1.json()["data"]["status"] == CallStatus.BUSY.value

    # No-answer outcome
    c2 = await client.post("/api/v1/calls", json={"customer_phone": "+919876543211"}, headers=headers)
    leg2 = next(l["telephony_leg_id"] for l in c2.json()["data"]["legs"] if l["leg_role"] == "CUSTOMER")
    id2 = c2.json()["data"]["id"]

    await client.post(
        "/api/v1/telephony/webhooks/mock",
        json={"telephony_leg_id": leg2, "event_type": "LEG_NO_ANSWER", "provider_event_id": "no-ans-1"},
    )
    chk2 = await client.get(f"/api/v1/calls/{id2}", headers=headers)
    assert chk2.json()["data"]["status"] == CallStatus.NO_ANSWER.value

def test_twilio_signature_verification_algorithm():
    """Verify Twilio HMAC-SHA1 signature computation according to official specification."""
    provider = TwilioTelephonyProvider(
        account_sid="AC1234567890",
        auth_token="test_auth_token_123",
        base_url="https://api.onground.ai",
    )

    url = "https://api.onground.ai/api/v1/telephony/webhooks/twilio"
    form_body = b"CallSid=CA123&CallStatus=completed"

    # Compute expected signature
    import hmac
    import hashlib
    import base64
    data_to_sign = url + "CallSidCA123" + "CallStatuscompleted"
    expected = base64.b64encode(
        hmac.new(b"test_auth_token_123", data_to_sign.encode("utf-8"), hashlib.sha1).digest()
    ).decode("utf-8")

    valid = provider.verify_webhook_signature(
        raw_headers={"X-Twilio-Signature": expected},
        raw_body=form_body,
        request_url=url,
    )
    assert valid is True

    # Bad signature
    invalid = provider.verify_webhook_signature(
        raw_headers={"X-Twilio-Signature": "wrong-signature"},
        raw_body=form_body,
        request_url=url,
    )
    assert invalid is False

@pytest.mark.asyncio
async def test_valid_indian_landline_with_std_code(client, mock_provider):
    """Verify outbound call initiation with valid Indian landline number with STD code."""
    headers = {"X-Dev-Agent-Id": settings.DEV_AGENT_ID}
    payload = {
        "customer_phone": "+918025539999",
        "customer_name": "Bangalore Office",
    }
    resp = await client.post("/api/v1/calls", json=payload, headers=headers)
    assert resp.status_code == 201
    data = resp.json()["data"]
    cust_leg = next(l for l in data["legs"] if l["leg_role"] == "CUSTOMER")
    assert cust_leg["to_endpoint_uri"] == "+918025539999"
    assert data["status"] == CallStatus.AGENT_RINGING.value

@pytest.mark.asyncio
async def test_call_lifecycle_ringing_connected_completed(client, mock_provider):
    """Verify full end-to-end webhook lifecycle from ringing -> connected -> completed."""
    headers = {"X-Dev-Agent-Id": settings.DEV_AGENT_ID}
    c = await client.post("/api/v1/calls", json={"customer_phone": "+919876543210"}, headers=headers)
    call_data = c.json()["data"]
    call_id = call_data["id"]
    agent_leg_id = next(l["telephony_leg_id"] for l in call_data["legs"] if l["leg_role"] == "AGENT")
    customer_leg_id = next(l["telephony_leg_id"] for l in call_data["legs"] if l["leg_role"] == "CUSTOMER")

    # 1. Agent leg answers -> call enters CUSTOMER_RINGING
    await client.post(
        "/api/v1/telephony/webhooks/mock",
        json={"telephony_leg_id": agent_leg_id, "event_type": "CALL_CONNECTED", "provider_event_id": "c-agent-1"},
    )
    r1 = await client.get(f"/api/v1/calls/{call_id}", headers=headers)
    assert r1.json()["data"]["status"] == CallStatus.CUSTOMER_RINGING.value

    # 2. Customer leg answers -> call enters CONNECTED
    await client.post(
        "/api/v1/telephony/webhooks/mock",
        json={"telephony_leg_id": customer_leg_id, "event_type": "CALL_CONNECTED", "provider_event_id": "c-cust-1"},
    )
    r2 = await client.get(f"/api/v1/calls/{call_id}", headers=headers)
    assert r2.json()["data"]["status"] == CallStatus.CONNECTED.value
    assert r2.json()["data"]["connected_at"] is not None

    # 3. Customer leg completed webhook -> call enters WRAPUP
    await client.post(
        "/api/v1/telephony/webhooks/mock",
        json={"telephony_leg_id": customer_leg_id, "event_type": "CALL_COMPLETED", "provider_event_id": "end-1"},
    )
    r3 = await client.get(f"/api/v1/calls/{call_id}", headers=headers)
    assert r3.json()["data"]["status"] in (CallStatus.WRAPUP.value, CallStatus.COMPLETED.value)
    assert r3.json()["data"]["ended_at"] is not None

@pytest.mark.asyncio
async def test_partial_initiation_failure_rolls_back_agent_leg(monkeypatch):
    """Verify that if customer leg dispatch fails, the agent leg is rolled back and hung up."""
    async with AsyncSessionLocal() as session:
        mock = MockTelephonyProvider()
        service = TelephonyService(session, provider=mock)

        # Make the 2nd initiate_leg call (customer leg) fail
        call_count = 0
        original_initiate = mock.initiate_leg
        async def flaky_initiate(req):
            nonlocal call_count
            call_count += 1
            if call_count == 2:
                raise RuntimeError("Customer network error during dispatch")
            return await original_initiate(req)

        mock.initiate_leg = flaky_initiate

        with pytest.raises(RuntimeError) as exc:
            await service.initiate_call(
                agent_id=uuid.uuid4(),
                customer_id=uuid.uuid4(),
                customer_phone="+919876543210",
            )
        assert "Customer network error during dispatch" in str(exc.value)

        # Verify that agent leg was dispatched and then rolled back (terminated)
        assert len(mock.dispatched_legs) == 1
        assert mock.dispatched_legs[0].leg_role.value == "AGENT"
        assert len(mock.terminated_legs) == 1

@pytest.mark.asyncio
async def test_bridge_call_endpoint_error_responses(client, mock_provider):
    """Verify POST /calls/{id}/bridge returns 404 for missing call, 400 for terminated legs, and 502 on provider failure."""
    headers = {"X-Dev-Agent-Id": settings.DEV_AGENT_ID}

    # 1. Missing call returns 404 Not Found
    fake_id = uuid.uuid4()
    resp_404 = await client.post(f"/api/v1/calls/{fake_id}/bridge", headers=headers)
    assert resp_404.status_code == 404

    # 2. Call with terminated legs returns 400 Bad Request
    create_resp = await client.post("/api/v1/calls", json={"customer_phone": "+919876543210"}, headers=headers)
    call_id = create_resp.json()["data"]["id"]

    # Terminate call
    await client.post(f"/api/v1/calls/{call_id}/terminate", json={"reason": "Test end"}, headers=headers)

    # Attempt to bridge terminated call
    resp_400 = await client.post(f"/api/v1/calls/{call_id}/bridge", headers=headers)
    assert resp_400.status_code == 400
    assert "Cannot bridge legs that are already terminated" in resp_400.json()["detail"]

    # 3. Provider bridge failure returns 502 Bad Gateway
    create_resp2 = await client.post("/api/v1/calls", json={"customer_phone": "+919876543211"}, headers=headers)
    call_id2 = create_resp2.json()["data"]["id"]

    mock_provider.bridge_should_fail = True
    mock_provider.bridge_failure_message = "Twilio/Plivo bridge media server down"

    resp_502 = await client.post(f"/api/v1/calls/{call_id2}/bridge", headers=headers)
    assert resp_502.status_code == 502
    assert "Twilio/Plivo bridge media server down" in resp_502.json()["detail"]

@pytest.mark.asyncio
async def test_two_real_legs_dispatched_and_persisted(client, mock_provider):
    """Verify initiate_call creates and dispatches exactly two real legs (AGENT and CUSTOMER) with provider IDs."""
    headers = {"X-Dev-Agent-Id": settings.DEV_AGENT_ID}
    payload = {
        "customer_phone": "+919876543210",
        "agent_phone": "+919000000002",
        "customer_name": "Deepa Rao",
    }
    resp = await client.post("/api/v1/calls", json=payload, headers=headers)
    assert resp.status_code == 201
    call = resp.json()["data"]

    assert call["status"] == CallStatus.AGENT_RINGING.value
    legs = call["legs"]
    assert len(legs) == 2

    agent_leg = next(l for l in legs if l["leg_role"] == "AGENT")
    cust_leg = next(l for l in legs if l["leg_role"] == "CUSTOMER")

    assert agent_leg["telephony_leg_id"].startswith("mock-leg-")
    assert cust_leg["telephony_leg_id"].startswith("mock-leg-")
    assert agent_leg["to_endpoint_uri"] == "+919000000002"
    assert cust_leg["to_endpoint_uri"] == "+919876543210"

    assert len(mock_provider.dispatched_legs) == 2
    assert mock_provider.dispatched_legs[0].leg_role.value == "AGENT"
    assert mock_provider.dispatched_legs[1].leg_role.value == "CUSTOMER"

@pytest.mark.asyncio
async def test_one_answered_leg_cannot_mark_connected(client, mock_provider):
    """Verify call remains in ringing state and does NOT bridge if only one leg answers."""
    headers = {"X-Dev-Agent-Id": settings.DEV_AGENT_ID}
    resp = await client.post("/api/v1/calls", json={"customer_phone": "+919876543210"}, headers=headers)
    call_data = resp.json()["data"]
    call_id = call_data["id"]
    agent_leg_id = next(l["telephony_leg_id"] for l in call_data["legs"] if l["leg_role"] == "AGENT")
    cust_leg_id = next(l["telephony_leg_id"] for l in call_data["legs"] if l["leg_role"] == "CUSTOMER")

    # 1. Agent leg answers first
    await client.post(
        "/api/v1/telephony/webhooks/mock",
        json={"telephony_leg_id": agent_leg_id, "event_type": "CALL_CONNECTED", "provider_event_id": "ans-agent"},
    )
    chk1 = await client.get(f"/api/v1/calls/{call_id}", headers=headers)
    # Must be in ringing, NOT CONNECTED
    assert chk1.json()["data"]["status"] == CallStatus.CUSTOMER_RINGING.value
    assert chk1.json()["data"]["connected_at"] is None
    # No bridging must have occurred
    assert len(mock_provider.bridged_legs) == 0

@pytest.mark.asyncio
async def test_bridge_failure_propagates_and_marks_failed(client, mock_provider):
    """Verify that if carrier bridge fails when both legs answer, call is marked FAILED and legs terminated."""
    headers = {"X-Dev-Agent-Id": settings.DEV_AGENT_ID}
    resp = await client.post("/api/v1/calls", json={"customer_phone": "+919876543210"}, headers=headers)
    call_data = resp.json()["data"]
    call_id = call_data["id"]
    agent_leg_id = next(l["telephony_leg_id"] for l in call_data["legs"] if l["leg_role"] == "AGENT")
    cust_leg_id = next(l["telephony_leg_id"] for l in call_data["legs"] if l["leg_role"] == "CUSTOMER")

    # Agent answers
    await client.post(
        "/api/v1/telephony/webhooks/mock",
        json={"telephony_leg_id": agent_leg_id, "event_type": "CALL_CONNECTED", "provider_event_id": "bf-ag-1"},
    )

    # Set mock provider bridge to fail
    mock_provider.bridge_should_fail = True
    mock_provider.bridge_failure_message = "Carrier media server bridge timeout"

    # Customer answers -> triggers bridge, which fails
    await client.post(
        "/api/v1/telephony/webhooks/mock",
        json={"telephony_leg_id": cust_leg_id, "event_type": "CALL_CONNECTED", "provider_event_id": "bf-cu-1"},
    )

    chk = await client.get(f"/api/v1/calls/{call_id}", headers=headers)
    data = chk.json()["data"]
    assert data["status"] == CallStatus.FAILED.value
    assert data["connected_at"] is None
    # Both legs must have been terminated
    assert len(mock_provider.terminated_legs) == 2
    assert agent_leg_id in mock_provider.terminated_legs
    assert cust_leg_id in mock_provider.terminated_legs

@pytest.mark.asyncio
async def test_production_mode_rejects_missing_agent_endpoint(monkeypatch):
    """Verify that in production environment, initiate_call strictly rejects missing agent_endpoint_uri without fallback."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "DEV_AGENT_PHONE", "+919000000001")

    async with AsyncSessionLocal() as session:
        mock = MockTelephonyProvider()
        service = TelephonyService(session, provider=mock)

        with pytest.raises(ValueError) as exc:
            await service.initiate_call(
                agent_id=uuid.uuid4(),
                customer_id=uuid.uuid4(),
                customer_phone="+919876543210",
                agent_endpoint_uri=None, # Missing in production
            )
        assert "Agent endpoint URI or phone number is required in production environment." in str(exc.value)

@pytest.mark.asyncio
async def test_plivo_request_uuid_correlation_and_update(client, mock_provider):
    """Verify that incoming Plivo webhooks correlating via RequestUUID update CallLegModel.telephony_leg_id to CallUUID."""
    headers = {"X-Dev-Agent-Id": settings.DEV_AGENT_ID}
    resp = await client.post("/api/v1/calls", json={"customer_phone": "+919876543210"}, headers=headers)
    call_data = resp.json()["data"]
    call_id = call_data["id"]

    cust_leg = next(l for l in call_data["legs"] if l["leg_role"] == "CUSTOMER")
    initial_request_uuid = cust_leg["telephony_leg_id"]
    permanent_call_uuid = f"plivo-call-uuid-{uuid.uuid4()}"

    # Inbound webhook referencing RequestUUID (initial request UUID) with new CallUUID
    webhook_payload = {
        "RequestUUID": initial_request_uuid,
        "CallUUID": permanent_call_uuid,
        "telephony_leg_id": permanent_call_uuid,
        "event_type": "LEG_RINGING",
        "provider_event_id": "plivo-corr-evt-1",
    }

    wh_res = await client.post("/api/v1/telephony/webhooks/mock", json=webhook_payload)
    assert wh_res.status_code == 200

    # Verify that the leg was correlated and its telephony_leg_id updated to the permanent CallUUID
    chk = await client.get(f"/api/v1/calls/{call_id}", headers=headers)
    updated_cust_leg = next(l for l in chk.json()["data"]["legs"] if l["leg_role"] == "CUSTOMER")
    assert updated_cust_leg["telephony_leg_id"] == permanent_call_uuid

@pytest.mark.asyncio
async def test_leg_failure_terminates_other_leg(client, mock_provider):
    """Verify that if one leg encounters failure or busy, the remaining active leg is terminated immediately."""
    headers = {"X-Dev-Agent-Id": settings.DEV_AGENT_ID}
    resp = await client.post("/api/v1/calls", json={"customer_phone": "+919876543210"}, headers=headers)
    call_data = resp.json()["data"]
    call_id = call_data["id"]
    agent_leg_id = next(l["telephony_leg_id"] for l in call_data["legs"] if l["leg_role"] == "AGENT")
    cust_leg_id = next(l["telephony_leg_id"] for l in call_data["legs"] if l["leg_role"] == "CUSTOMER")

    # Customer leg returns BUSY
    await client.post(
        "/api/v1/telephony/webhooks/mock",
        json={"telephony_leg_id": cust_leg_id, "event_type": "LEG_BUSY", "provider_event_id": "busy-term-1"},
    )

    # Agent leg should have been terminated
    assert agent_leg_id in mock_provider.terminated_legs

    chk = await client.get(f"/api/v1/calls/{call_id}", headers=headers)
    data = chk.json()["data"]
    assert data["status"] == CallStatus.BUSY.value
    agent_leg = next(l for l in data["legs"] if l["leg_role"] == "AGENT")
    assert agent_leg["status"] == CallLegStatus.CANCELLED.value

