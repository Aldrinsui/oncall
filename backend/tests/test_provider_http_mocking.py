import base64
import hashlib
import hmac
import uuid
from typing import Dict, Any
from urllib.parse import parse_qsl

import httpx
import pytest
from httpx import AsyncClient, ASGITransport

from backend.app.core.config import settings
from backend.app.domains.common.enums import (
    CallLegRole,
    EndpointType,
    CallStatus,
)
from backend.app.domains.telephony.base import LegDialRequest
from backend.app.domains.telephony.twilio_provider import TwilioTelephonyProvider
from backend.app.domains.telephony.plivo_provider import PlivoTelephonyProvider
from backend.app.services.telephony_service import TelephonyService
from backend.app.core.database import async_engine, Base, AsyncSessionLocal
from backend.app.main import app

_real_async_client = httpx.AsyncClient

@pytest.fixture(autouse=True)
async def setup_test_db():
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

# ==============================================================================
# 1. Twilio Provider HTTP Mock Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_twilio_http_successful_call_creation(monkeypatch):
    """Verify Twilio provider handles 201 Created from Twilio Voice REST API."""
    async def mock_handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url).startswith("https://api.twilio.com/2010-04-01/Accounts/AC_TEST_ACCOUNT/Calls.json")
        assert request.method == "POST"
        return httpx.Response(
            status_code=201,
            json={"sid": "CA_MOCK_TWILIO_SID_12345", "status": "queued"},
        )

    mock_transport = httpx.MockTransport(mock_handler)
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: _real_async_client(transport=mock_transport))

    provider = TwilioTelephonyProvider(
        account_sid="AC_TEST_ACCOUNT",
        auth_token="auth_token_secret",
        caller_id="+15551234567",
        base_url="https://api.onground.ai",
    )

    req = LegDialRequest(
        call_id=str(uuid.uuid4()),
        leg_role=CallLegRole.CUSTOMER,
        attempt_number=1,
        to_endpoint_type=EndpointType.PSTN,
        to_endpoint_uri="+919876543210",
        from_endpoint_type=EndpointType.PSTN,
        from_endpoint_uri="+15551234567",
        callback_url="https://api.onground.ai/api/v1/telephony/webhooks/twilio",
    )

    res = await provider.initiate_leg(req)
    assert res.telephony_leg_id == "CA_MOCK_TWILIO_SID_12345"
    assert res.provider == "twilio"
    assert res.is_simulated is False

@pytest.mark.asyncio
async def test_twilio_http_invalid_credentials(monkeypatch):
    """Verify Twilio provider raises RuntimeError on 401 Unauthorized credentials."""
    async def mock_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status_code=401,
            json={"code": 20003, "message": "Authentication Error - Invalid Account SID or Auth Token"},
        )

    mock_transport = httpx.MockTransport(mock_handler)
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: _real_async_client(transport=mock_transport))

    provider = TwilioTelephonyProvider(
        account_sid="AC_INVALID",
        auth_token="bad_token",
        caller_id="+15551234567",
        base_url="https://api.onground.ai",
    )

    req = LegDialRequest(
        call_id=str(uuid.uuid4()),
        leg_role=CallLegRole.CUSTOMER,
        attempt_number=1,
        to_endpoint_type=EndpointType.PSTN,
        to_endpoint_uri="+919876543210",
        from_endpoint_type=EndpointType.PSTN,
        from_endpoint_uri="+15551234567",
        callback_url="https://api.onground.ai/api/v1/telephony/webhooks/twilio",
    )

    with pytest.raises(RuntimeError) as exc_info:
        await provider.initiate_leg(req)
    assert "Twilio API Error (401)" in str(exc_info.value)
    assert "Authentication Error" in str(exc_info.value)

@pytest.mark.asyncio
async def test_twilio_http_rejected_caller_id(monkeypatch):
    """Verify Twilio provider handles 400 Bad Request when Caller ID is unverified/rejected."""
    async def mock_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status_code=400,
            json={"code": 21212, "message": "The 'From' number +15550000000 is not a valid phone number, or not verified."},
        )

    mock_transport = httpx.MockTransport(mock_handler)
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: _real_async_client(transport=mock_transport))

    provider = TwilioTelephonyProvider(
        account_sid="AC_TEST_ACCOUNT",
        auth_token="auth_token_secret",
        caller_id="+15550000000",
        base_url="https://api.onground.ai",
    )

    req = LegDialRequest(
        call_id=str(uuid.uuid4()),
        leg_role=CallLegRole.CUSTOMER,
        attempt_number=1,
        to_endpoint_type=EndpointType.PSTN,
        to_endpoint_uri="+919876543210",
        from_endpoint_type=EndpointType.PSTN,
        from_endpoint_uri="+15550000000",
        callback_url="https://api.onground.ai/api/v1/telephony/webhooks/twilio",
    )

    with pytest.raises(RuntimeError) as exc_info:
        await provider.initiate_leg(req)
    assert "Twilio API Error (400)" in str(exc_info.value)
    assert "not a valid phone number" in str(exc_info.value)

@pytest.mark.asyncio
async def test_twilio_http_server_error_500(monkeypatch):
    """Verify Twilio provider handles 500 Internal Server Error gracefully."""
    async def mock_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code=500, text="Internal Server Error")

    mock_transport = httpx.MockTransport(mock_handler)
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: _real_async_client(transport=mock_transport))

    provider = TwilioTelephonyProvider(
        account_sid="AC_TEST_ACCOUNT",
        auth_token="auth_token_secret",
        caller_id="+15551234567",
        base_url="https://api.onground.ai",
    )

    req = LegDialRequest(
        call_id=str(uuid.uuid4()),
        leg_role=CallLegRole.CUSTOMER,
        attempt_number=1,
        to_endpoint_type=EndpointType.PSTN,
        to_endpoint_uri="+919876543210",
        from_endpoint_type=EndpointType.PSTN,
        from_endpoint_uri="+15551234567",
        callback_url="https://api.onground.ai/api/v1/telephony/webhooks/twilio",
    )

    with pytest.raises(RuntimeError) as exc_info:
        await provider.initiate_leg(req)
    assert "Twilio API Error (500)" in str(exc_info.value)

@pytest.mark.asyncio
async def test_twilio_http_leg_termination_and_bridge(monkeypatch):
    """Verify Twilio provider terminates leg and bridges active legs with conference TwiML."""
    post_requests = []
    async def mock_handler(request: httpx.Request) -> httpx.Response:
        post_requests.append(request)
        return httpx.Response(status_code=200, json={"status": "completed"})

    mock_transport = httpx.MockTransport(mock_handler)
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: _real_async_client(transport=mock_transport))

    provider = TwilioTelephonyProvider(
        account_sid="AC_TEST_ACCOUNT",
        auth_token="auth_token_secret",
        caller_id="+15551234567",
        base_url="https://api.onground.ai",
    )

    # 1. Test terminate_leg
    await provider.terminate_leg("CA_TEST_SID")
    assert len(post_requests) == 1
    assert "CA_TEST_SID.json" in str(post_requests[0].url)

    # 2. Test bridge_legs
    await provider.bridge_legs("call-uuid-1", "CA_AGENT_SID", "CA_CUST_SID")
    assert len(post_requests) == 3
    # Verify both legs received TwiML conference update
    assert any("CA_AGENT_SID.json" in str(r.url) for r in post_requests)
    assert any("CA_CUST_SID.json" in str(r.url) for r in post_requests)

# ==============================================================================
# 2. Plivo Provider HTTP Mock Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_plivo_http_successful_call_creation(monkeypatch):
    """Verify Plivo provider handles 201 Created from Plivo Voice API."""
    async def mock_handler(request: httpx.Request) -> httpx.Response:
        assert "api.plivo.com/v1/Account/MAMOCKAUTHID/Call/" in str(request.url)
        assert request.method == "POST"
        return httpx.Response(
            status_code=201,
            json={"message": "call fired", "request_uuid": "plivo-uuid-987654321"},
        )

    mock_transport = httpx.MockTransport(mock_handler)
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: _real_async_client(transport=mock_transport))

    provider = PlivoTelephonyProvider(
        auth_id="MAMOCKAUTHID",
        auth_token="plivo_secret_token",
        caller_id="+918012345678",
        base_url="https://api.onground.ai",
    )

    req = LegDialRequest(
        call_id=str(uuid.uuid4()),
        leg_role=CallLegRole.CUSTOMER,
        attempt_number=1,
        to_endpoint_type=EndpointType.PSTN,
        to_endpoint_uri="+919876543210",
        from_endpoint_type=EndpointType.PSTN,
        from_endpoint_uri="+918012345678",
        callback_url="https://api.onground.ai/api/v1/telephony/webhooks/plivo",
    )

    res = await provider.initiate_leg(req)
    assert res.telephony_leg_id == "plivo-uuid-987654321"
    assert res.provider == "plivo"
    assert res.is_simulated is False

@pytest.mark.asyncio
async def test_plivo_http_invalid_credentials(monkeypatch):
    """Verify Plivo provider handles 401 Unauthorized from Plivo API."""
    async def mock_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status_code=401,
            json={"error": "Invalid auth credentials provided"},
        )

    mock_transport = httpx.MockTransport(mock_handler)
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: _real_async_client(transport=mock_transport))

    provider = PlivoTelephonyProvider(
        auth_id="BAD_AUTH_ID",
        auth_token="bad_token",
        caller_id="+918012345678",
        base_url="https://api.onground.ai",
    )

    req = LegDialRequest(
        call_id=str(uuid.uuid4()),
        leg_role=CallLegRole.CUSTOMER,
        attempt_number=1,
        to_endpoint_type=EndpointType.PSTN,
        to_endpoint_uri="+919876543210",
        from_endpoint_type=EndpointType.PSTN,
        from_endpoint_uri="+918012345678",
        callback_url="https://api.onground.ai/api/v1/telephony/webhooks/plivo",
    )

    with pytest.raises(RuntimeError) as exc_info:
        await provider.initiate_leg(req)
    assert "Plivo API Error (401)" in str(exc_info.value)

@pytest.mark.asyncio
async def test_plivo_http_rejected_caller_id(monkeypatch):
    """Verify Plivo provider handles 400 Bad Request on invalid Caller ID."""
    async def mock_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status_code=400,
            json={"error": "The 'from' number is not a valid caller ID in your Plivo account"},
        )

    mock_transport = httpx.MockTransport(mock_handler)
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: _real_async_client(transport=mock_transport))

    provider = PlivoTelephonyProvider(
        auth_id="MAMOCKAUTHID",
        auth_token="plivo_secret_token",
        caller_id="+910000000000",
        base_url="https://api.onground.ai",
    )

    req = LegDialRequest(
        call_id=str(uuid.uuid4()),
        leg_role=CallLegRole.CUSTOMER,
        attempt_number=1,
        to_endpoint_type=EndpointType.PSTN,
        to_endpoint_uri="+919876543210",
        from_endpoint_type=EndpointType.PSTN,
        from_endpoint_uri="+910000000000",
        callback_url="https://api.onground.ai/api/v1/telephony/webhooks/plivo",
    )

    with pytest.raises(RuntimeError) as exc_info:
        await provider.initiate_leg(req)
    assert "Plivo API Error (400)" in str(exc_info.value)
    assert "valid caller ID" in str(exc_info.value)

@pytest.mark.asyncio
async def test_plivo_http_leg_termination_and_bridge(monkeypatch):
    """Verify Plivo leg termination (DELETE) and bridging (POST transfer)."""
    requests_made = []
    async def mock_handler(request: httpx.Request) -> httpx.Response:
        requests_made.append(request)
        if request.method == "DELETE":
            return httpx.Response(status_code=204)
        return httpx.Response(status_code=200, json={"message": "call transferred"})

    mock_transport = httpx.MockTransport(mock_handler)
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: _real_async_client(transport=mock_transport))

    provider = PlivoTelephonyProvider(
        auth_id="MAMOCKAUTHID",
        auth_token="plivo_secret_token",
        caller_id="+918012345678",
        base_url="https://api.onground.ai",
    )

    # 1. Terminate leg
    await provider.terminate_leg("plivo-leg-uuid-1")
    assert len(requests_made) == 1
    assert requests_made[0].method == "DELETE"
    assert "plivo-leg-uuid-1" in str(requests_made[0].url)

    # 2. Bridge legs
    await provider.bridge_legs("call-uuid-2", "plivo-agent-uuid", "plivo-cust-uuid")
    assert len(requests_made) == 3
    assert any("plivo-agent-uuid" in str(r.url) for r in requests_made)
    assert any("plivo-cust-uuid" in str(r.url) for r in requests_made)

def test_plivo_cryptographic_signature_v2_verification():
    """Verify Plivo V2 HMAC-SHA256 signature verification."""
    auth_token = "plivo_secret_auth_token_456"
    provider = PlivoTelephonyProvider(
        auth_id="MAMOCKAUTHID",
        auth_token=auth_token,
        caller_id="+918012345678",
        base_url="https://api.onground.ai",
    )

    url = "https://api.onground.ai/api/v1/telephony/webhooks/plivo"
    nonce = "1234567890abcdef"
    body = b"CallUUID=plivo-123&CallStatus=completed"

    # Compute expected Plivo V2 signature: HMAC-SHA256(url + nonce + sorted_post_params)
    data_to_sign = url + nonce + "CallStatuscompleted" + "CallUUIDplivo-123"
    expected_sig = base64.b64encode(
        hmac.new(auth_token.encode("utf-8"), data_to_sign.encode("utf-8"), hashlib.sha256).digest()
    ).decode("utf-8")

    headers = {
        "X-Plivo-Signature-V2": expected_sig,
        "X-Plivo-Signature-V2-Nonce": nonce,
    }

    assert provider.verify_webhook_signature(headers, body, request_url=url) is True

    # Bad signature
    bad_headers = {
        "X-Plivo-Signature-V2": "invalid-signature",
        "X-Plivo-Signature-V2-Nonce": nonce,
    }
    assert provider.verify_webhook_signature(bad_headers, body, request_url=url) is False

    # Explicit invalid mock header
    invalid_mock = {
        "X-Plivo-Signature-V2": expected_sig,
        "X-Plivo-Signature-V2-Nonce": nonce,
        "x-mock-signature": "invalid",
    }
    assert provider.verify_webhook_signature(invalid_mock, body, request_url=url) is False

# ==============================================================================
# 3. Caller ID Selection and TelephonyService Safety Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_caller_id_strictly_enforces_configured_provider_caller_id(monkeypatch):
    """
    Verify TelephonyService uses configured TWILIO_CALLER_ID / PLIVO_CALLER_ID
    and NEVER silently falls back to DEV_AGENT_PHONE for real providers.
    """
    async with AsyncSessionLocal() as session:
        # 1. Twilio missing caller ID raises ValueError
        monkeypatch.setattr(settings, "TELEPHONY_PROVIDER", "twilio")
        monkeypatch.setattr(settings, "TWILIO_CALLER_ID", "")
        monkeypatch.setattr(settings, "DEV_AGENT_PHONE", "+919999999999")

        twilio_provider = TwilioTelephonyProvider(account_sid="AC123", auth_token="token", caller_id="")
        service = TelephonyService(session, provider=twilio_provider)

        with pytest.raises(ValueError) as exc:
            await service.initiate_call(
                agent_id=uuid.uuid4(),
                customer_id=uuid.uuid4(),
                customer_phone="+919876543210",
            )
        assert "Twilio Caller ID is not configured" in str(exc.value)

        # 2. Plivo missing caller ID raises ValueError
        monkeypatch.setattr(settings, "TELEPHONY_PROVIDER", "plivo")
        monkeypatch.setattr(settings, "PLIVO_CALLER_ID", "")

        plivo_provider = PlivoTelephonyProvider(auth_id="MA123", auth_token="token", caller_id="")
        service = TelephonyService(session, provider=plivo_provider)

        with pytest.raises(ValueError) as exc:
            await service.initiate_call(
                agent_id=uuid.uuid4(),
                customer_id=uuid.uuid4(),
                customer_phone="+919876543210",
            )
        assert "Plivo Caller ID is not configured" in str(exc.value)

@pytest.mark.asyncio
async def test_plivo_answer_and_conference_endpoints():
    """Verify Plivo answer XML and conference XML endpoints return valid application/xml."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Test answer endpoint
        ans_resp = await client.post("/api/v1/telephony/webhooks/plivo/answer")
        assert ans_resp.status_code == 200
        assert "application/xml" in ans_resp.headers["content-type"]
        assert "<Response>" in ans_resp.text
        assert "<Speak" in ans_resp.text

        # 2. Test conference endpoint
        conf_resp = await client.get("/api/v1/telephony/webhooks/plivo/conference?room=conf-test-456")
        assert conf_resp.status_code == 200
        assert "application/xml" in conf_resp.headers["content-type"]
        assert "<Conference beep=\"false\">conf-test-456</Conference>" in conf_resp.text

@pytest.mark.asyncio
async def test_production_mode_requires_https_webhook_url(monkeypatch):
    """Verify production environment rejects localhost or non-https webhook URLs."""
    async with AsyncSessionLocal() as session:
        monkeypatch.setattr(settings, "ENVIRONMENT", "production")
        monkeypatch.setattr(settings, "TELEPHONY_PROVIDER", "twilio")
        monkeypatch.setattr(settings, "TWILIO_CALLER_ID", "+15551234567")
        monkeypatch.setattr(settings, "PUBLIC_WEBHOOK_URL", "http://localhost:8000")

        twilio_provider = TwilioTelephonyProvider(account_sid="AC123", auth_token="token", caller_id="+15551234567")
        service = TelephonyService(session, provider=twilio_provider)

        with pytest.raises(ValueError) as exc:
            await service.initiate_call(
                agent_id=uuid.uuid4(),
                customer_id=uuid.uuid4(),
                customer_phone="+919876543210",
            )
        assert "requires a publicly reachable HTTPS PUBLIC_WEBHOOK_URL" in str(exc.value)

@pytest.mark.asyncio
async def test_bridge_call_endpoint():
    """Verify POST /calls/{id}/bridge successfully bridges legs and transitions call to CONNECTED."""
    from backend.app.domains.telephony.provider_factory import set_telephony_provider
    from backend.app.domains.telephony.mock_provider import MockTelephonyProvider
    set_telephony_provider(MockTelephonyProvider())

    transport = ASGITransport(app=app)
    headers = {"X-Dev-Agent-Id": settings.DEV_AGENT_ID}
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create a call
        init_resp = await client.post(
            "/api/v1/calls",
            json={"customer_phone": "+919876543210"},
            headers=headers,
        )
        assert init_resp.status_code == 201
        call_id = init_resp.json()["data"]["id"]

        # Call bridge endpoint
        bridge_resp = await client.post(
            f"/api/v1/calls/{call_id}/bridge",
            headers=headers,
        )
        assert bridge_resp.status_code == 200
        data = bridge_resp.json()["data"]
        assert data["status"] == CallStatus.CONNECTED.value
        assert data["connected_at"] is not None

@pytest.mark.asyncio
async def test_twilio_bridge_legs_error_propagation(monkeypatch):
    """Verify Twilio provider bridge_legs raises RuntimeError when Twilio API returns error."""
    async def mock_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code=500, text="Internal Twilio Server Error")

    mock_transport = httpx.MockTransport(mock_handler)
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: _real_async_client(transport=mock_transport))

    provider = TwilioTelephonyProvider(
        account_sid="AC_TEST",
        auth_token="auth_token",
        caller_id="+15551234567",
        base_url="https://api.onground.ai",
    )

    with pytest.raises(RuntimeError) as exc_info:
        await provider.bridge_legs("call-123", "CA_AGENT", "CA_CUST")
    assert "Twilio bridge failed" in str(exc_info.value)

@pytest.mark.asyncio
async def test_plivo_bridge_legs_error_propagation(monkeypatch):
    """Verify Plivo provider bridge_legs raises RuntimeError when Plivo API returns error."""
    async def mock_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code=400, text="Invalid call leg state")

    mock_transport = httpx.MockTransport(mock_handler)
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: _real_async_client(transport=mock_transport))

    provider = PlivoTelephonyProvider(
        auth_id="MA_TEST",
        auth_token="auth_token",
        caller_id="+918012345678",
        base_url="https://api.onground.ai",
    )

    with pytest.raises(RuntimeError) as exc_info:
        await provider.bridge_legs("call-123", "PL_AGENT", "PL_CUST")
    assert "Plivo bridge failed" in str(exc_info.value)

@pytest.mark.asyncio
async def test_twilio_initiate_leg_uses_conference_twiml(monkeypatch):
    """Verify Twilio initiate_leg sends conference TwiML connecting the call directly to conf-{call_id}."""
    captured_twiml = None

    async def mock_handler(request: httpx.Request) -> httpx.Response:
        nonlocal captured_twiml
        body = parse_qsl(request.content.decode("utf-8"))
        body_dict = dict(body)
        captured_twiml = body_dict.get("Twiml")
        return httpx.Response(status_code=201, json={"sid": "CA_CONF_TEST"})

    mock_transport = httpx.MockTransport(mock_handler)
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: _real_async_client(transport=mock_transport))

    provider = TwilioTelephonyProvider(
        account_sid="AC_TEST",
        auth_token="auth_token",
        caller_id="+15551234567",
        base_url="https://api.onground.ai",
    )

    call_id = "test-call-uuid-999"
    req = LegDialRequest(
        call_id=call_id,
        leg_role=CallLegRole.CUSTOMER,
        attempt_number=1,
        to_endpoint_type=EndpointType.PSTN,
        to_endpoint_uri="+919876543210",
        from_endpoint_type=EndpointType.PSTN,
        from_endpoint_uri="+15551234567",
        callback_url="https://api.onground.ai/api/v1/telephony/webhooks/twilio",
    )

    res = await provider.initiate_leg(req)
    assert res.telephony_leg_id == "CA_CONF_TEST"
    assert captured_twiml is not None
    assert f"<Conference beep=\"false\" startConferenceOnEnter=\"true\" endConferenceOnExit=\"true\">conf-{call_id}</Conference>" in captured_twiml
    assert "<Hangup/>" not in captured_twiml

@pytest.mark.asyncio
async def test_plivo_initiate_leg_uses_conference_answer_url(monkeypatch):
    """Verify Plivo initiate_leg specifies answer_url joining conf-{call_id} conference room."""
    captured_payload = None

    async def mock_handler(request: httpx.Request) -> httpx.Response:
        nonlocal captured_payload
        import json
        captured_payload = json.loads(request.content.decode("utf-8"))
        return httpx.Response(status_code=201, json={"request_uuid": "PL_CONF_TEST"})

    mock_transport = httpx.MockTransport(mock_handler)
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: _real_async_client(transport=mock_transport))

    provider = PlivoTelephonyProvider(
        auth_id="MA_TEST",
        auth_token="auth_token",
        caller_id="+918012345678",
        base_url="https://api.onground.ai",
    )

    call_id = "test-plivo-call-uuid-888"
    req = LegDialRequest(
        call_id=call_id,
        leg_role=CallLegRole.CUSTOMER,
        attempt_number=1,
        to_endpoint_type=EndpointType.PSTN,
        to_endpoint_uri="+919876543210",
        from_endpoint_type=EndpointType.PSTN,
        from_endpoint_uri="+918012345678",
        callback_url="https://api.onground.ai/api/v1/telephony/webhooks/plivo",
    )

    res = await provider.initiate_leg(req)
    assert res.telephony_leg_id == "PL_CONF_TEST"
    assert captured_payload is not None
    assert captured_payload["answer_url"] == f"https://api.onground.ai/api/v1/telephony/webhooks/plivo/conference?room=conf-{call_id}"

@pytest.mark.asyncio
async def test_twilio_http_per_leg_caller_id_dispatch(monkeypatch):
    """Verify Twilio provider posts the exact per-leg Caller ID in HTTP form data for agent and customer legs."""
    from urllib.parse import parse_qs

    posted_requests = []

    async def mock_handler(request: httpx.Request) -> httpx.Response:
        content_str = request.content.decode("utf-8")
        parsed = parse_qs(content_str)
        posted_requests.append(parsed)
        call_sid = f"CA_LEG_{len(posted_requests)}"
        return httpx.Response(status_code=201, json={"sid": call_sid})

    mock_transport = httpx.MockTransport(mock_handler)
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: _real_async_client(transport=mock_transport))

    agent_caller_id = "+919800000001"
    customer_caller_id = "+919800000002"
    agent_phone = "+919123456789"
    customer_phone = "+919876543210"

    provider = TwilioTelephonyProvider(
        account_sid="AC_PER_LEG_TEST",
        auth_token="auth_token_123",
        agent_caller_id=agent_caller_id,
        customer_caller_id=customer_caller_id,
        caller_id="+919999999999",
        base_url="https://api.onground.ai",
    )

    # 1. Dispatch Agent Leg with explicit from_endpoint_uri
    agent_req = LegDialRequest(
        call_id="call-leg-test-1",
        leg_role=CallLegRole.AGENT,
        attempt_number=1,
        to_endpoint_type=EndpointType.PSTN,
        to_endpoint_uri=agent_phone,
        from_endpoint_type=EndpointType.PSTN,
        from_endpoint_uri=agent_caller_id,
        callback_url="https://api.onground.ai/api/v1/telephony/webhooks/twilio",
    )
    res_agent = await provider.initiate_leg(agent_req)
    assert res_agent.telephony_leg_id == "CA_LEG_1"

    # 2. Dispatch Customer Leg with explicit from_endpoint_uri
    customer_req = LegDialRequest(
        call_id="call-leg-test-1",
        leg_role=CallLegRole.CUSTOMER,
        attempt_number=1,
        to_endpoint_type=EndpointType.PSTN,
        to_endpoint_uri=customer_phone,
        from_endpoint_type=EndpointType.PSTN,
        from_endpoint_uri=customer_caller_id,
        callback_url="https://api.onground.ai/api/v1/telephony/webhooks/twilio",
    )
    res_cust = await provider.initiate_leg(customer_req)
    assert res_cust.telephony_leg_id == "CA_LEG_2"

    # Verify posted form payloads
    assert len(posted_requests) == 2

    agent_form = posted_requests[0]
    assert agent_form["From"] == [agent_caller_id]
    assert agent_form["To"] == [agent_phone]
    assert "conf-call-leg-test-1" in agent_form["Twiml"][0]

    cust_form = posted_requests[1]
    assert cust_form["From"] == [customer_caller_id]
    assert cust_form["To"] == [customer_phone]
    assert "conf-call-leg-test-1" in cust_form["Twiml"][0]

    # 3. Test fallback when request.from_endpoint_uri is empty: uses role-specific caller IDs
    agent_req_fallback = LegDialRequest(
        call_id="call-leg-test-2",
        leg_role=CallLegRole.AGENT,
        attempt_number=1,
        to_endpoint_type=EndpointType.PSTN,
        to_endpoint_uri=agent_phone,
        from_endpoint_type=EndpointType.PSTN,
        from_endpoint_uri="",
        callback_url="https://api.onground.ai/api/v1/telephony/webhooks/twilio",
    )
    await provider.initiate_leg(agent_req_fallback)
    assert posted_requests[2]["From"] == [agent_caller_id]

    cust_req_fallback = LegDialRequest(
        call_id="call-leg-test-2",
        leg_role=CallLegRole.CUSTOMER,
        attempt_number=1,
        to_endpoint_type=EndpointType.PSTN,
        to_endpoint_uri=customer_phone,
        from_endpoint_type=EndpointType.PSTN,
        from_endpoint_uri="",
        callback_url="https://api.onground.ai/api/v1/telephony/webhooks/twilio",
    )
    await provider.initiate_leg(cust_req_fallback)
    assert posted_requests[3]["From"] == [customer_caller_id]
