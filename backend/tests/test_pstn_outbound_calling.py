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

    assert data["status"] == CallStatus.CUSTOMER_RINGING.value
    assert len(data["legs"]) == 1
    assert data["legs"][0]["to_endpoint_uri"] == "+919876543210"
    assert data["legs"][0]["telephony_leg_id"] is not None
    assert len(mock_provider.dispatched_legs) == 1

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
    assert len(mock_provider.terminated_legs) == 1

@pytest.mark.asyncio
async def test_webhook_processing_and_deduplication(client, mock_provider):
    """Verify webhook transitions call to CONNECTED and ignores duplicate event deliveries."""
    headers = {"X-Dev-Agent-Id": settings.DEV_AGENT_ID}

    create_resp = await client.post(
        "/api/v1/calls", json={"customer_phone": "+919876543210"}, headers=headers
    )
    call_data = create_resp.json()["data"]
    call_id = call_data["id"]
    leg_id = call_data["legs"][0]["telephony_leg_id"]

    # 1. Send call connected webhook
    webhook_payload = {
        "call_id": call_id,
        "telephony_leg_id": leg_id,
        "event_type": "CALL_CONNECTED",
        "provider_event_id": "evt-unique-12345",
    }
    wh_resp1 = await client.post("/api/v1/telephony/webhooks/mock", json=webhook_payload)
    assert wh_resp1.status_code == 200

    # Verify status is now CONNECTED
    get_resp1 = await client.get(f"/api/v1/calls/{call_id}", headers=headers)
    assert get_resp1.json()["data"]["status"] == CallStatus.CONNECTED.value

    # 2. Resend duplicate webhook event
    wh_resp2 = await client.post("/api/v1/telephony/webhooks/mock", json=webhook_payload)
    assert wh_resp2.status_code == 200
    assert "Duplicate event ignored" in wh_resp2.json()["message"]

@pytest.mark.asyncio
async def test_webhook_busy_and_no_answer_outcomes(client, mock_provider):
    """Verify provider busy and no-answer webhooks update status accurately."""
    headers = {"X-Dev-Agent-Id": settings.DEV_AGENT_ID}

    # Busy outcome
    c1 = await client.post("/api/v1/calls", json={"customer_phone": "+919876543210"}, headers=headers)
    leg1 = c1.json()["data"]["legs"][0]["telephony_leg_id"]
    id1 = c1.json()["data"]["id"]

    await client.post(
        "/api/v1/telephony/webhooks/mock",
        json={"telephony_leg_id": leg1, "event_type": "LEG_BUSY", "provider_event_id": "busy-1"},
    )
    chk1 = await client.get(f"/api/v1/calls/{id1}", headers=headers)
    assert chk1.json()["data"]["status"] == CallStatus.BUSY.value

    # No-answer outcome
    c2 = await client.post("/api/v1/calls", json={"customer_phone": "+919876543211"}, headers=headers)
    leg2 = c2.json()["data"]["legs"][0]["telephony_leg_id"]
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
    assert data["legs"][0]["to_endpoint_uri"] == "+918025539999"
    assert data["status"] == CallStatus.CUSTOMER_RINGING.value

@pytest.mark.asyncio
async def test_call_lifecycle_ringing_connected_completed(client, mock_provider):
    """Verify full end-to-end webhook lifecycle from ringing -> connected -> completed."""
    headers = {"X-Dev-Agent-Id": settings.DEV_AGENT_ID}
    c = await client.post("/api/v1/calls", json={"customer_phone": "+919876543210"}, headers=headers)
    call_data = c.json()["data"]
    call_id = call_data["id"]
    leg_id = call_data["legs"][0]["telephony_leg_id"]

    # 1. Ringing webhook
    await client.post(
        "/api/v1/telephony/webhooks/mock",
        json={"telephony_leg_id": leg_id, "event_type": "LEG_RINGING", "provider_event_id": "r-1"},
    )
    r1 = await client.get(f"/api/v1/calls/{call_id}", headers=headers)
    assert r1.json()["data"]["status"] == CallStatus.CUSTOMER_RINGING.value

    # 2. Connected webhook
    await client.post(
        "/api/v1/telephony/webhooks/mock",
        json={"telephony_leg_id": leg_id, "event_type": "CALL_CONNECTED", "provider_event_id": "c-1"},
    )
    r2 = await client.get(f"/api/v1/calls/{call_id}", headers=headers)
    assert r2.json()["data"]["status"] == CallStatus.CONNECTED.value
    assert r2.json()["data"]["connected_at"] is not None

    # 3. Completed webhook
    await client.post(
        "/api/v1/telephony/webhooks/mock",
        json={"telephony_leg_id": leg_id, "event_type": "CALL_COMPLETED", "provider_event_id": "end-1"},
    )
    r3 = await client.get(f"/api/v1/calls/{call_id}", headers=headers)
    assert r3.json()["data"]["status"] in (CallStatus.WRAPUP.value, CallStatus.COMPLETED.value)
    assert r3.json()["data"]["ended_at"] is not None

