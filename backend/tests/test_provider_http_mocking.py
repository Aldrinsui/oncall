import base64
import hashlib
import hmac
import json
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
from backend.app.domains.telephony.exotel_provider import ExotelTelephonyProvider
from backend.app.domains.telephony.provider_factory import get_telephony_provider
from backend.app.services.telephony_service import TelephonyService
from backend.app.core.database import async_engine, Base, AsyncSessionLocal
from backend.app.main import app

_real_async_client = httpx.AsyncClient

@pytest.fixture(autouse=True)
async def setup_test_db():
    get_telephony_provider(force_reload=True)
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    get_telephony_provider(force_reload=True)

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

# ==============================================================================
# 3. Exotel Provider HTTP Mock Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_exotel_provider_auth_validation_and_repr_redaction():
    """Verify Exotel credentials validation and credential redaction in __repr__."""
    # 1. Missing account_sid
    p_no_sid = ExotelTelephonyProvider(account_sid="", api_key="key1", api_token="tok1")
    with pytest.raises(ValueError, match="EXOTEL_ACCOUNT_SID is required"):
        p_no_sid.get_auth()

    # 2. Missing key or token
    p_no_key = ExotelTelephonyProvider(account_sid="EXO_1", api_key="", api_token="tok1")
    with pytest.raises(ValueError, match="please set EXOTEL_API_KEY and EXOTEL_API_TOKEN"):
        p_no_key.get_auth()

    p_no_tok = ExotelTelephonyProvider(account_sid="EXO_1", api_key="key1", api_token="")
    with pytest.raises(ValueError, match="please set EXOTEL_API_KEY and EXOTEL_API_TOKEN"):
        p_no_tok.get_auth()

    # 3. Successful auth
    p_valid = ExotelTelephonyProvider(account_sid="EXO_1", api_key="my_key", api_token="my_token")
    auth = p_valid.get_auth()
    assert auth == ("my_key", "my_token")

    # 4. Credential redaction in repr: never print plain text secrets
    rep = repr(p_valid)
    assert "EXO_1" in rep
    assert "configured" in rep
    assert "my_key" not in rep
    assert "my_token" not in rep

@pytest.mark.asyncio
async def test_exotel_http_successful_call_creation(monkeypatch):
    """Verify Exotel provider handles 200/201 from Exotel v1 Calls/connect API."""
    captured_requests = []

    async def mock_handler(request: httpx.Request) -> httpx.Response:
        assert "/v1/Accounts/EXO_TEST_ACCOUNT/Calls/connect" in str(request.url)
        assert "/v2/" not in str(request.url)
        assert request.method == "POST"
        body_bytes = request.read()
        from urllib.parse import parse_qs
        form_params = parse_qs(body_bytes.decode("utf-8"))
        captured_requests.append((request, form_params))

        # Return Exotel v1 XML response
        xml_resp = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<TwilioResponse>'
            '  <Call>'
            '    <Sid>c2c_exotel_sid_12345</Sid>'
            '    <Status>queued</Status>'
            '    <AccountSid>EXO_TEST_ACCOUNT</AccountSid>'
            '    <From>+919123456789</From>'
            '    <To>+919876543210</To>'
            '    <PhoneNumberSid>+918012345678</PhoneNumberSid>'
            '  </Call>'
            '</TwilioResponse>'
        )
        return httpx.Response(
            status_code=200,
            text=xml_resp,
            headers={"Content-Type": "application/xml"},
        )

    mock_transport = httpx.MockTransport(mock_handler)
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: _real_async_client(transport=mock_transport))

    provider = ExotelTelephonyProvider(
        account_sid="EXO_TEST_ACCOUNT",
        api_key="exotel_key_abc",
        api_token="exotel_token_xyz",
        api_base_url="https://api.exotel.com",
        caller_id="+918012345678",
        webhook_base_url="https://api.onground.ai",
    )

    call_sid = await provider.connect(
        call_id="call-uuid-exotel-1",
        from_number="+919123456789",
        to_number="+919876543210",
        caller_id="+918012345678",
        callback_url="https://api.onground.ai/api/v1/telephony/webhooks/exotel",
        time_limit=300,
    )

    assert call_sid == "c2c_exotel_sid_12345"
    assert len(captured_requests) == 1
    req_obj, params = captured_requests[0]

    # Verify form parameters
    assert params["From"] == ["+919123456789"]
    assert params["To"] == ["+919876543210"]
    assert params["CallerId"] == ["+918012345678"]
    assert params["CustomField"] == ["call-uuid-exotel-1"]
    assert params["TimeLimit"] == ["300"]
    assert "https://api.onground.ai/api/v1/telephony/webhooks/exotel" in params["StatusCallback"][0]
    assert "StatusCallbackEvents" not in params

    # Verify HTTP Basic Auth header
    auth_header = req_obj.headers.get("authorization", "")
    assert auth_header.startswith("Basic ")
    decoded_auth = base64.b64decode(auth_header.split(" ")[1]).decode("utf-8")
    assert decoded_auth == "exotel_key_abc:exotel_token_xyz"

@pytest.mark.asyncio
async def test_exotel_http_invalid_credentials(monkeypatch):
    """Verify Exotel provider handles 401 Unauthorized from Exotel API."""
    async def mock_handler(request: httpx.Request) -> httpx.Response:
        xml_err = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<TwilioResponse>'
            '  <RestException>'
            '    <Status>401</Status>'
            '    <Message>Authentication Error - Invalid API Key or Token</Message>'
            '    <Code>401</Code>'
            '  </RestException>'
            '</TwilioResponse>'
        )
        return httpx.Response(
            status_code=401,
            text=xml_err,
            headers={"Content-Type": "application/xml"},
        )

    mock_transport = httpx.MockTransport(mock_handler)
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: _real_async_client(transport=mock_transport))

    provider = ExotelTelephonyProvider(
        account_sid="EXO_INVALID",
        api_key="bad_key",
        api_token="bad_token",
        caller_id="+918012345678",
    )

    with pytest.raises(RuntimeError) as exc_info:
        await provider.connect(
            call_id=str(uuid.uuid4()),
            from_number="+919123456789",
            to_number="+919876543210",
        )
    assert "401" in str(exc_info.value)
    assert "Invalid API Key or Token" in str(exc_info.value)

@pytest.mark.asyncio
async def test_exotel_http_xml_failure_parsing(monkeypatch):
    """Verify Exotel XML error responses (e.g. 400 Bad Request) are accurately parsed and preserved."""
    async def mock_handler(request: httpx.Request) -> httpx.Response:
        xml_err = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<TwilioResponse>'
            '  <RestException>'
            '    <Status>400</Status>'
            '    <Message>Exotel API version v2 not supported.</Message>'
            '    <Code>400</Code>'
            '  </RestException>'
            '</TwilioResponse>'
        )
        return httpx.Response(
            status_code=400,
            text=xml_err,
            headers={"Content-Type": "application/xml"},
        )

    mock_transport = httpx.MockTransport(mock_handler)
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: _real_async_client(transport=mock_transport))

    provider = ExotelTelephonyProvider(
        account_sid="EXO_TEST",
        api_key="key",
        api_token="token",
        caller_id="+918012345678",
    )

    with pytest.raises(RuntimeError) as exc_info:
        await provider.connect(
            call_id="call-err-1",
            from_number="+919123456789",
            to_number="+919876543210",
        )
    assert "400" in str(exc_info.value)
    assert "Exotel API version v2 not supported." in str(exc_info.value)

@pytest.mark.asyncio
async def test_exotel_http_rejected_caller_id():
    """Verify Exotel provider rejects outbound call when no Caller ID is configured."""
    provider = ExotelTelephonyProvider(
        account_sid="EXO_TEST",
        api_key="key",
        api_token="token",
        caller_id="",
    )

    with pytest.raises(ValueError, match="No valid Caller ID"):
        await provider.connect(
            call_id=str(uuid.uuid4()),
            from_number="+919123456789",
            to_number="+919876543210",
            caller_id="",
        )

@pytest.mark.asyncio
async def test_exotel_http_leg_termination_and_bridging(monkeypatch):
    """Verify Exotel provider terminates calls via v1 Calls API and performs no-op bridging without v2 endpoints."""
    post_requests = []

    async def mock_handler(request: httpx.Request) -> httpx.Response:
        assert "/v2/" not in str(request.url)
        post_requests.append(str(request.url))
        if "/v1/Accounts/EXO_TEST/Calls/c2c_exo_123" in str(request.url):
            return httpx.Response(status_code=200, json={"status": "completed"})
        return httpx.Response(status_code=404)

    mock_transport = httpx.MockTransport(mock_handler)
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: _real_async_client(transport=mock_transport))

    provider = ExotelTelephonyProvider(
        account_sid="EXO_TEST",
        api_key="key",
        api_token="token",
        caller_id="+918012345678",
        base_url="https://api.onground.ai",
    )

    # 1. Test terminate_leg via v1
    await provider.terminate_leg("c2c_exo_123")
    assert len(post_requests) == 1
    assert "/v1/Accounts/EXO_TEST/Calls/c2c_exo_123" in post_requests[0]
    assert "/v2/" not in post_requests[0]

    # 2. Test bridge_legs: in v1, bridging is automatic so bridge_legs is a clean no-op
    await provider.bridge_legs("call-uuid-1", "c2c_exo_123", "c2c_exo_123")
    assert len(post_requests) == 1  # No additional HTTP request made

@pytest.mark.asyncio
async def test_exotel_cryptographic_signature_verification():
    """Verify Exotel webhook signature verification using HMAC-SHA256."""
    token = "secret_exotel_webhook_token"
    provider = ExotelTelephonyProvider(
        account_sid="EXO_TEST",
        api_key="key",
        api_token=token,
    )

    raw_body = b'{"event_type": "leg_lifecycle_event", "event_name": "leg_answered", "leg_sid": "leg_123"}'
    computed_digest = hmac.new(token.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()

    # 1. Valid signature with sha256= prefix
    valid_headers_prefix = {"x-exotel-signature": f"sha256={computed_digest}"}
    assert provider.verify_webhook_signature(valid_headers_prefix, raw_body) is True

    # 2. Valid signature bare hex
    valid_headers_bare = {"X-Exotel-Signature": computed_digest}
    assert provider.verify_webhook_signature(valid_headers_bare, raw_body) is True

    # 3. Invalid signature
    invalid_headers = {"x-exotel-signature": "sha256=wrong_digest_0000000000000000"}
    assert provider.verify_webhook_signature(invalid_headers, raw_body) is False

    # 4. Altered body
    altered_body = b'{"tampered": true}'
    assert provider.verify_webhook_signature(valid_headers_prefix, altered_body) is False

    # 5. Missing header
    assert provider.verify_webhook_signature({}, raw_body) is False

@pytest.mark.asyncio
async def test_exotel_webhook_event_parsing():
    """Verify Exotel webhook event normalization across v2 and v1 formats."""
    provider = ExotelTelephonyProvider(account_sid="EXO_TEST", api_key="k", api_token="t")

    # 1. v2 leg_ringing
    evt_ringing = provider.parse_webhook_event({}, {
        "event_type": "leg_lifecycle_event",
        "event_name": "leg_ringing",
        "leg_sid": "leg_ring_123",
    })
    assert evt_ringing.provider == "exotel"
    assert evt_ringing.telephony_leg_id == "leg_ring_123"
    assert evt_ringing.event_type.value == "LEG_RINGING"

    # 2. v2 leg_answered
    evt_ans = provider.parse_webhook_event({}, {
        "event_type": "leg_lifecycle_event",
        "event_name": "leg_answered",
        "leg_sid": "leg_ans_123",
    })
    assert evt_ans.event_type.value == "CALL_CONNECTED"

    # 3. v2 leg_terminated with completed
    evt_term = provider.parse_webhook_event({}, {
        "event_type": "leg_lifecycle_event",
        "event_name": "leg_terminated",
        "terminal_status": "completed",
        "leg_sid": "leg_term_123",
    })
    assert evt_term.event_type.value == "CALL_COMPLETED"

    # 4. v2 leg_terminated with busy
    evt_busy = provider.parse_webhook_event({}, {
        "event_name": "leg_terminated",
        "terminal_status": "busy",
        "leg_sid": "leg_busy_123",
    })
    assert evt_busy.event_type.value == "CALL_BUSY"

    # 5. v2 leg_terminated with no-answer
    evt_noans = provider.parse_webhook_event({}, {
        "event_name": "leg_terminated",
        "terminal_status": "no-answer",
        "leg_sid": "leg_noans_123",
    })
    assert evt_noans.event_type.value == "CALL_NO_ANSWER"

    # 6. v1 StatusCallback format
    evt_v1 = provider.parse_webhook_event({}, {
        "CallSid": "call_v1_sid",
        "Status": "completed",
    })
    assert evt_v1.telephony_leg_id == "call_v1_sid"
    assert evt_v1.event_type.value == "CALL_COMPLETED"

@pytest.mark.asyncio
async def test_exotel_factory_registration(monkeypatch):
    """Verify 'exotel' provider can be registered and fetched from provider_factory."""
    monkeypatch.setattr(settings, "TELEPHONY_PROVIDER", "exotel")
    monkeypatch.setattr(settings, "EXOTEL_ACCOUNT_SID", "EXO_FACTORY_TEST")
    monkeypatch.setattr(settings, "EXOTEL_API_KEY", "key_fac")
    monkeypatch.setattr(settings, "EXOTEL_API_TOKEN", "tok_fac")

    prov = get_telephony_provider(force_reload=True)
    assert isinstance(prov, ExotelTelephonyProvider)
    assert prov.account_sid == "EXO_FACTORY_TEST"

@pytest.mark.asyncio
async def test_exotel_full_orchestrated_call_flow_and_lifecycle(monkeypatch):
    """
    End-to-end PSTN demonstration test for Exotel v1 Calls/connect:
    1. Initiates outbound call via FastAPI endpoint.
    2. Verifies provider dispatches EXACTLY ONE Calls/connect request with From, To, CallerId, CustomField.
    3. Verifies both agent and customer legs persist Call.Sid without pretending independent IDs.
    4. Simulates answered webhook correlated via CustomField with HMAC-SHA256 signature.
    5. Verifies deduplication when identical webhook is received.
    6. Simulates terminal (completed) webhook and verifies wrapup/completed transitions.
    7. Verifies NO v2 endpoints are invoked at any point.
    """
    account_sid = "EXO_E2E_ACCOUNT"
    api_key = "exo_key_test"
    api_token = "exo_token_test"
    caller_id = "+918012345678"
    agent_phone = "+919123456789"
    customer_phone = "+919876543210"

    monkeypatch.setattr(settings, "TELEPHONY_PROVIDER", "exotel")
    monkeypatch.setattr(settings, "EXOTEL_ACCOUNT_SID", account_sid)
    monkeypatch.setattr(settings, "EXOTEL_API_KEY", api_key)
    monkeypatch.setattr(settings, "EXOTEL_API_TOKEN", api_token)
    monkeypatch.setattr(settings, "EXOTEL_CALLER_ID", caller_id)
    monkeypatch.setattr(settings, "DEV_AGENT_PHONE", agent_phone)
    monkeypatch.setattr(settings, "EXOTEL_API_BASE_URL", "https://api.exotel.com")
    get_telephony_provider(force_reload=True)

    calls_dispatched = []

    async def mock_handler(request: httpx.Request) -> httpx.Response:
        req_url = str(request.url)
        assert "/v2/" not in req_url, f"Unexpected Exotel v2 API invoked: {req_url}"

        if "/v1/Accounts/EXO_E2E_ACCOUNT/Calls/connect" in req_url and request.method == "POST":
            from urllib.parse import parse_qs
            body_bytes = request.read()
            params = parse_qs(body_bytes.decode("utf-8"))
            calls_dispatched.append((request, params))

            xml_resp = (
                '<?xml version="1.0" encoding="UTF-8"?>'
                '<TwilioResponse>'
                '  <Call>'
                '    <Sid>c2c_exo_e2e_123</Sid>'
                '    <Status>queued</Status>'
                '    <AccountSid>EXO_E2E_ACCOUNT</AccountSid>'
                '    <From>+919123456789</From>'
                '    <To>+919876543210</To>'
                '  </Call>'
                '</TwilioResponse>'
            )
            return httpx.Response(status_code=200, text=xml_resp, headers={"Content-Type": "application/xml"})

        elif f"/v1/Accounts/{account_sid}/Calls/c2c_exo_e2e_123" in req_url:
            return httpx.Response(status_code=200, json={"status": "completed"})

        return httpx.Response(status_code=404)

    mock_transport = httpx.MockTransport(mock_handler)
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: _real_async_client(transport=mock_transport))

    headers = {"X-Dev-Agent-Id": settings.DEV_AGENT_ID}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Initiate outbound call
        payload = {
            "customer_phone": customer_phone,
            "customer_name": "Kavita Rao",
            "agent_phone": agent_phone,
            "notes": "Testing Exotel v1 Calls/connect outbound call",
        }
        resp = await client.post("/api/v1/calls", json=payload, headers=headers)
        assert resp.status_code == 201, resp.text
        call_data = resp.json()["data"]
        call_id = call_data["id"]

        # Exactly ONE Calls/connect POST dispatched to Exotel
        assert len(calls_dispatched) == 1
        req_obj, form_params = calls_dispatched[0]
        assert form_params["From"] == [agent_phone]
        assert form_params["To"] == [customer_phone]
        assert form_params["CallerId"] == [caller_id]
        assert form_params["CustomField"] == [call_id]
        assert form_params["TimeLimit"] == ["300"]
        assert "StatusCallbackEvents" not in form_params

        # Logical agent and customer legs preserved with Call.Sid
        assert len(call_data["legs"]) == 2
        agent_leg = next(l for l in call_data["legs"] if l["leg_role"] == "AGENT")
        customer_leg = next(l for l in call_data["legs"] if l["leg_role"] == "CUSTOMER")

        assert agent_leg["provider"] == "exotel"
        assert agent_leg["telephony_leg_id"] == "c2c_exo_e2e_123"
        assert agent_leg["to_endpoint_uri"] == agent_phone

        assert customer_leg["provider"] == "exotel"
        assert customer_leg["telephony_leg_id"] == "c2c_exo_e2e_123"
        assert customer_leg["to_endpoint_uri"] == customer_phone

        assert call_data["status"] == "AGENT_RINGING"

        # 2. Simulate Webhook: Both parties connected (answered) correlated by CustomField
        body_answered = json.dumps({
            "CallSid": "c2c_exo_e2e_123",
            "CustomField": call_id,
            "Status": "in-progress",
            "EventType": "answered",
        }).encode("utf-8")
        sig_ans = hmac.new(api_token.encode("utf-8"), body_answered, hashlib.sha256).hexdigest()
        wh_ans = await client.post(
            "/api/v1/telephony/webhooks/exotel",
            content=body_answered,
            headers={
                "Content-Type": "application/json",
                "X-Exotel-Signature": f"sha256={sig_ans}",
            },
        )
        assert wh_ans.status_code == 200
        assert wh_ans.json()["call_id"] == call_id

        # Check call is now CONNECTED
        call_resp = await client.get(f"/api/v1/calls/{call_id}", headers=headers)
        call_cur = call_resp.json()["data"]
        assert call_cur["status"] == "CONNECTED"
        assert all(l["status"] == "ANSWERED" for l in call_cur["legs"])

        # 3. Simulate duplicate webhook (should be de-duplicated idempotently)
        wh_dup = await client.post(
            "/api/v1/telephony/webhooks/exotel",
            content=body_answered,
            headers={
                "Content-Type": "application/json",
                "X-Exotel-Signature": f"sha256={sig_ans}",
            },
        )
        assert wh_dup.status_code == 200
        assert wh_dup.json()["message"] == "Duplicate event ignored"

        # 4. Trigger bridge endpoint (Exotel bridges automatically so this completes gracefully)
        bridge_resp = await client.post(f"/api/v1/calls/{call_id}/bridge", headers=headers)
        assert bridge_resp.status_code == 200, bridge_resp.text
        assert bridge_resp.json()["data"]["status"] == "CONNECTED"

        # 5. Simulate terminal completed webhook
        body_completed = json.dumps({
            "CallSid": "c2c_exo_e2e_123",
            "CustomField": call_id,
            "Status": "completed",
            "EventType": "terminal",
        }).encode("utf-8")
        sig_comp = hmac.new(api_token.encode("utf-8"), body_completed, hashlib.sha256).hexdigest()
        wh_comp = await client.post(
            "/api/v1/telephony/webhooks/exotel",
            content=body_completed,
            headers={
                "Content-Type": "application/json",
                "X-Exotel-Signature": f"sha256={sig_comp}",
            },
        )
        assert wh_comp.status_code == 200

        # Check call is now WRAPUP or COMPLETED
        final_call_resp = await client.get(f"/api/v1/calls/{call_id}", headers=headers)
        final_call = final_call_resp.json()["data"]
        assert final_call["status"] in ("WRAPUP", "COMPLETED")
        assert all(l["status"] == "COMPLETED" for l in final_call["legs"])


