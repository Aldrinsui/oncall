import base64
import hashlib
import hmac
import uuid
from typing import Dict, Any
from urllib.parse import parse_qsl

import httpx
import pytest
from pydantic import ValidationError

from backend.app.core.config import Settings
from backend.app.domains.common.enums import (
    CallLegRole,
    EndpointType,
)
from backend.app.domains.telephony.base import LegDialRequest
from backend.app.domains.telephony.twilio_provider import TwilioTelephonyProvider

_real_async_client = httpx.AsyncClient


def _decode_basic_auth(auth_header: str) -> tuple[str, str]:
    """Helper to decode HTTP Basic Authorization header into (username, password)."""
    assert auth_header.startswith("Basic ")
    encoded = auth_header[6:]
    decoded = base64.b64decode(encoded).decode("latin1")
    username, password = decoded.split(":", 1)
    return username, password


# ==============================================================================
# 1. Configuration & Settings Validation Tests
# ==============================================================================

def test_settings_twilio_api_key_fields_and_validation():
    """Verify Settings supports TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET and validates completeness."""
    # 1. Both empty: valid (falls back to Auth Token)
    s_default = Settings(
        TWILIO_ACCOUNT_SID="AC_MOCK_TEST_SID",
        TWILIO_AUTH_TOKEN="auth_token_value",
        TWILIO_API_KEY_SID="",
        TWILIO_API_KEY_SECRET="",
    )
    assert s_default.TWILIO_API_KEY_SID == ""
    assert s_default.TWILIO_API_KEY_SECRET == ""

    # 2. Both provided: valid
    s_with_keys = Settings(
        TWILIO_ACCOUNT_SID="AC_MOCK_TEST_SID",
        TWILIO_AUTH_TOKEN="auth_token_value",
        TWILIO_API_KEY_SID="SK_MOCK_TEST_KEY",
        TWILIO_API_KEY_SECRET="api_secret_value_xyz",
    )
    assert s_with_keys.TWILIO_API_KEY_SID == "SK_MOCK_TEST_KEY"
    assert s_with_keys.TWILIO_API_KEY_SECRET == "api_secret_value_xyz"

    # 3. Only SID provided: rejected with ValidationError
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            TWILIO_ACCOUNT_SID="AC_MOCK_TEST_SID",
            TWILIO_AUTH_TOKEN="auth_token_value",
            TWILIO_API_KEY_SID="SK_MOCK_TEST_KEY",
            TWILIO_API_KEY_SECRET="",
        )
    assert "Incomplete Twilio API Key configuration" in str(exc_info.value)

    # 4. Only Secret provided: rejected with ValidationError
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            TWILIO_ACCOUNT_SID="AC_MOCK_TEST_SID",
            TWILIO_AUTH_TOKEN="auth_token_value",
            TWILIO_API_KEY_SID="",
            TWILIO_API_KEY_SECRET="api_secret_value_xyz",
        )
    assert "Incomplete Twilio API Key configuration" in str(exc_info.value)


# ==============================================================================
# 2. Credential Resolution & Validation in TwilioTelephonyProvider
# ==============================================================================

def test_twilio_provider_get_rest_auth_with_api_keys():
    """Verify get_rest_auth returns (api_key_sid, api_key_secret) when both are configured."""
    provider = TwilioTelephonyProvider(
        account_sid="AC_REAL_ACCOUNT_123",
        auth_token="auth_token_value",
        api_key_sid="SK_TEST_KEY_SID",
        api_key_secret="secret_key_value_999",
        caller_id="+15551234567",
    )
    username, password = provider.get_rest_auth()
    assert username == "SK_TEST_KEY_SID"
    assert password == "secret_key_value_999"


def test_twilio_provider_fallback_to_auth_token():
    """Verify get_rest_auth falls back to (account_sid, auth_token) when API keys are omitted."""
    provider = TwilioTelephonyProvider(
        account_sid="AC_REAL_ACCOUNT_123",
        auth_token="auth_token_value",
        api_key_sid="",
        api_key_secret="",
        caller_id="+15551234567",
    )
    username, password = provider.get_rest_auth()
    assert username == "AC_REAL_ACCOUNT_123"
    assert password == "auth_token_value"


def test_twilio_provider_rejects_incomplete_api_keys_without_silent_fallback():
    """Verify provider rejects incomplete API key pairs and NEVER silently falls back to auth_token."""
    # SID set, Secret empty
    p1 = TwilioTelephonyProvider(
        account_sid="AC_REAL_ACCOUNT_123",
        auth_token="valid_auth_token",
        api_key_sid="SK_TEST_KEY_SID",
        api_key_secret="",
        caller_id="+15551234567",
    )
    with pytest.raises(ValueError) as exc1:
        p1.get_rest_auth()
    assert "Incomplete Twilio API Key configuration" in str(exc1.value)
    assert "will not fall back to TWILIO_AUTH_TOKEN" in str(exc1.value)

    # Secret set, SID empty
    p2 = TwilioTelephonyProvider(
        account_sid="AC_REAL_ACCOUNT_123",
        auth_token="valid_auth_token",
        api_key_sid="",
        api_key_secret="secret_value",
        caller_id="+15551234567",
    )
    with pytest.raises(ValueError) as exc2:
        p2.get_rest_auth()
    assert "Incomplete Twilio API Key configuration" in str(exc2.value)


def test_twilio_provider_rejects_missing_account_sid():
    """Verify provider rejects REST operations when account_sid is missing, even with API keys."""
    provider = TwilioTelephonyProvider(
        account_sid="",
        auth_token="token",
        api_key_sid="SK_KEY",
        api_key_secret="SECRET",
    )
    with pytest.raises(ValueError) as exc:
        provider.get_rest_auth()
    assert "TWILIO_ACCOUNT_SID is required" in str(exc.value)


def test_twilio_provider_rejects_no_credentials():
    """Verify provider raises ValueError when neither API keys nor auth_token are provided."""
    provider = TwilioTelephonyProvider(
        account_sid="AC_TEST",
        auth_token="",
        api_key_sid="",
        api_key_secret="",
    )
    with pytest.raises(ValueError) as exc:
        provider.get_rest_auth()
    assert "Twilio REST credentials not configured" in str(exc.value)


def test_twilio_provider_repr_redacts_credentials():
    """Verify __repr__ does not leak secrets, API keys, or auth tokens in logs/print statements."""
    provider = TwilioTelephonyProvider(
        account_sid="AC_TEST_ACCOUNT",
        auth_token="super_secret_auth_token",
        api_key_sid="SK_SUPER_SECRET_KEY",
        api_key_secret="super_secret_key_value",
    )
    rep = repr(provider)
    assert "super_secret_auth_token" not in rep
    assert "SK_SUPER_SECRET_KEY" not in rep
    assert "super_secret_key_value" not in rep
    assert "AC_TEST_ACCOUNT" in rep
    assert "configured" in rep


# ==============================================================================
# 3. HTTP Mock Tests: REST Authentication & URL Verification
# ==============================================================================

@pytest.mark.asyncio
async def test_initiate_leg_uses_api_key_basic_auth_and_account_sid_url(monkeypatch):
    """Verify initiate_leg sends Basic Auth using API Key pair while URL uses Account SID."""
    captured_request = None

    async def mock_handler(request: httpx.Request) -> httpx.Response:
        nonlocal captured_request
        captured_request = request
        return httpx.Response(status_code=201, json={"sid": "CA_API_KEY_CALL_123"})

    mock_transport = httpx.MockTransport(mock_handler)
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: _real_async_client(transport=mock_transport))

    provider = TwilioTelephonyProvider(
        account_sid="AC_MASTER_ACCOUNT_SID",
        auth_token="master_auth_token",
        api_key_sid="SK_RESTRICTED_KEY_SID",
        api_key_secret="restricted_secret_pass",
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
    assert res.telephony_leg_id == "CA_API_KEY_CALL_123"

    # 1. URL must use Account SID
    assert captured_request is not None
    assert str(captured_request.url) == "https://api.twilio.com/2010-04-01/Accounts/AC_MASTER_ACCOUNT_SID/Calls.json"

    # 2. Basic Auth must use (api_key_sid, api_key_secret), NOT (account_sid, auth_token)
    auth_hdr = captured_request.headers["authorization"]
    user, pwd = _decode_basic_auth(auth_hdr)
    assert user == "SK_RESTRICTED_KEY_SID"
    assert pwd == "restricted_secret_pass"
    assert user != "AC_MASTER_ACCOUNT_SID"
    assert pwd != "master_auth_token"


@pytest.mark.asyncio
async def test_terminate_leg_uses_api_key_basic_auth_and_account_sid_url(monkeypatch):
    """Verify terminate_leg uses API Key Basic Auth and Account SID in URL."""
    captured_request = None

    async def mock_handler(request: httpx.Request) -> httpx.Response:
        nonlocal captured_request
        captured_request = request
        return httpx.Response(status_code=200, json={"status": "completed"})

    mock_transport = httpx.MockTransport(mock_handler)
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: _real_async_client(transport=mock_transport))

    provider = TwilioTelephonyProvider(
        account_sid="AC_MASTER_ACCOUNT_SID",
        auth_token="master_auth_token",
        api_key_sid="SK_RESTRICTED_KEY_SID",
        api_key_secret="restricted_secret_pass",
        caller_id="+15551234567",
        base_url="https://api.onground.ai",
    )

    await provider.terminate_leg("CA_TERMINATE_123")

    assert captured_request is not None
    assert str(captured_request.url) == "https://api.twilio.com/2010-04-01/Accounts/AC_MASTER_ACCOUNT_SID/Calls/CA_TERMINATE_123.json"

    user, pwd = _decode_basic_auth(captured_request.headers["authorization"])
    assert user == "SK_RESTRICTED_KEY_SID"
    assert pwd == "restricted_secret_pass"


@pytest.mark.asyncio
async def test_bridge_legs_uses_api_key_basic_auth_and_account_sid_url(monkeypatch):
    """Verify bridge_legs uses API Key Basic Auth and Account SID for both customer and agent legs."""
    captured_requests = []

    async def mock_handler(request: httpx.Request) -> httpx.Response:
        captured_requests.append(request)
        return httpx.Response(status_code=200, json={"status": "in-progress"})

    mock_transport = httpx.MockTransport(mock_handler)
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: _real_async_client(transport=mock_transport))

    provider = TwilioTelephonyProvider(
        account_sid="AC_MASTER_ACCOUNT_SID",
        auth_token="master_auth_token",
        api_key_sid="SK_RESTRICTED_KEY_SID",
        api_key_secret="restricted_secret_pass",
        caller_id="+15551234567",
        base_url="https://api.onground.ai",
    )

    await provider.bridge_legs("call-uuid-99", "CA_AGENT_LEG_SID", "CA_CUST_LEG_SID")

    assert len(captured_requests) == 2
    for req in captured_requests:
        assert "/Accounts/AC_MASTER_ACCOUNT_SID/Calls/" in str(req.url)
        user, pwd = _decode_basic_auth(req.headers["authorization"])
        assert user == "SK_RESTRICTED_KEY_SID"
        assert pwd == "restricted_secret_pass"


# ==============================================================================
# 4. Webhook Signature Verification Exclusively Uses TWILIO_AUTH_TOKEN
# ==============================================================================

def test_webhook_signature_verification_uses_auth_token_not_api_key():
    """
    Verify webhook signature verification (HMAC-SHA1) exclusively uses TWILIO_AUTH_TOKEN.
    Even when API keys are configured, signatures created with api_key_secret must FAIL,
    and signatures created with auth_token must SUCCEED.
    """
    auth_token = "primary_account_auth_token_secret"
    api_key_secret = "restricted_api_key_secret_not_for_webhooks"

    provider = TwilioTelephonyProvider(
        account_sid="AC_MASTER_ACCOUNT_SID",
        auth_token=auth_token,
        api_key_sid="SK_RESTRICTED_KEY_SID",
        api_key_secret=api_key_secret,
        caller_id="+15551234567",
        base_url="https://api.onground.ai",
    )

    url = "https://api.onground.ai/api/v1/telephony/webhooks/twilio"
    form_body = b"CallSid=CA1234567890&CallStatus=in-progress&From=%2B919876543210"

    # Compute expected signature using Auth Token
    data_to_sign = url + "CallSidCA1234567890" + "CallStatusin-progress" + "From+919876543210"
    valid_sig = base64.b64encode(
        hmac.new(auth_token.encode("utf-8"), data_to_sign.encode("utf-8"), hashlib.sha1).digest()
    ).decode("utf-8")

    # Compute signature using API Key Secret (incorrect for webhooks)
    wrong_sig_from_api_key = base64.b64encode(
        hmac.new(api_key_secret.encode("utf-8"), data_to_sign.encode("utf-8"), hashlib.sha1).digest()
    ).decode("utf-8")

    # 1. Valid signature using Auth Token succeeds
    assert provider.verify_webhook_signature(
        raw_headers={"X-Twilio-Signature": valid_sig},
        raw_body=form_body,
        request_url=url,
    ) is True

    # 2. Signature using API Key Secret fails
    assert provider.verify_webhook_signature(
        raw_headers={"X-Twilio-Signature": wrong_sig_from_api_key},
        raw_body=form_body,
        request_url=url,
    ) is False

    # 3. Tampered signature fails
    assert provider.verify_webhook_signature(
        raw_headers={"X-Twilio-Signature": "tampered_signature_value"},
        raw_body=form_body,
        request_url=url,
    ) is False
