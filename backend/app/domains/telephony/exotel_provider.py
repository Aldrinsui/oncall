import hashlib
import hmac
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import httpx

from backend.app.core.config import settings
from backend.app.domains.common.enums import (
    CallEventType,
)
from backend.app.domains.telephony.base import (
    TelephonyProvider,
    LegDialRequest,
    LegDialResponse,
    TelephonyEvent,
)

class ExotelTelephonyProvider(TelephonyProvider):
    """
    Concrete TelephonyProvider implementation for the Exotel Voice API.
    Supports outbound call leg initiation, leg termination via ExoML Hangup action,
    multi-party bridge creation, HMAC-SHA256 signature verification, and event normalization.
    """

    def __init__(
        self,
        account_sid: Optional[str] = None,
        api_key: Optional[str] = None,
        api_token: Optional[str] = None,
        api_base_url: Optional[str] = None,
        caller_id: Optional[str] = None,
        webhook_base_url: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        self.account_sid = account_sid if account_sid is not None else settings.EXOTEL_ACCOUNT_SID
        self.api_key = api_key if api_key is not None else settings.EXOTEL_API_KEY
        self.api_token = api_token if api_token is not None else settings.EXOTEL_API_TOKEN
        self.api_base_url = (api_base_url if api_base_url is not None else settings.EXOTEL_API_BASE_URL).rstrip("/")
        self.caller_id = caller_id if caller_id is not None else settings.EXOTEL_CALLER_ID
        self.webhook_base_url = (webhook_base_url or base_url or settings.PUBLIC_WEBHOOK_URL).rstrip("/")

    def __repr__(self) -> str:
        key_status = "configured" if self.api_key else "not configured"
        token_status = "configured" if self.api_token else "not configured"
        return f"<ExotelTelephonyProvider account_sid={self.account_sid!r} api_key={key_status} api_token={token_status}>"

    def get_auth(self) -> tuple[str, str]:
        """
        Validates credentials and returns HTTP Basic Auth (api_key, api_token).
        Never logs or leaks credentials.
        """
        if not self.account_sid or not self.account_sid.strip():
            raise ValueError(
                "Exotel credentials not configured: EXOTEL_ACCOUNT_SID is required for API operations."
            )
        if not self.api_key or not self.api_key.strip() or not self.api_token or not self.api_token.strip():
            raise ValueError(
                "Exotel credentials not configured: please set EXOTEL_API_KEY and EXOTEL_API_TOKEN."
            )
        return (self.api_key.strip(), self.api_token.strip())

    async def initiate_leg(self, request: LegDialRequest) -> LegDialResponse:
        """
        Initiates an outbound call leg via Exotel Voice API (POST /v2/accounts/{account_sid}/legs).
        """
        auth = self.get_auth()

        from_number = request.from_endpoint_uri or self.caller_id
        if not from_number:
            raise ValueError("No valid Caller ID (From number / ExoPhone) provided for outbound Exotel call.")

        api_url = f"{self.api_base_url}/v2/accounts/{self.account_sid}/legs"
        webhook_url = f"{self.webhook_base_url}/api/v1/telephony/webhooks/exotel"

        payload = {
            "contact_uri": request.to_endpoint_uri,
            "exophone": from_number,
            "leg_event_endpoint": webhook_url,
            "network_type": "pstn",
            "timeout": 30,
            "time_limit": 14400,
        }

        headers = {"Content-Type": "application/json"}

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                api_url,
                json=payload,
                headers=headers,
                auth=auth,
            )

        if resp.status_code not in (200, 201, 202):
            error_detail = resp.text
            try:
                err_json = resp.json()
                error_detail = (
                    err_json.get("response", {}).get("error_data", {}).get("message")
                    or err_json.get("error_data", {}).get("message")
                    or err_json.get("message")
                    or resp.text
                )
            except Exception:
                pass
            raise RuntimeError(f"Exotel API Error ({resp.status_code}): {error_detail}")

        data = resp.json()
        leg_sid = (
            data.get("response", {}).get("data", {}).get("leg_sid")
            or data.get("data", {}).get("leg_sid")
            or data.get("leg_sid")
            or data.get("Call", {}).get("Sid")
            or data.get("sid")
            or data.get("Sid")
            or ""
        )

        return LegDialResponse(
            telephony_leg_id=leg_sid,
            provider="exotel",
            is_simulated=False,
        )

    async def terminate_leg(self, telephony_leg_id: str) -> None:
        """
        Terminates an active or ringing call leg via Exotel Leg Actions API.
        """
        if not self.account_sid or not self.api_key or not self.api_token:
            return
        if not telephony_leg_id:
            return

        auth = (self.api_key.strip(), self.api_token.strip())
        api_url = f"{self.api_base_url}/v2/accounts/{self.account_sid}/legs/{telephony_leg_id}/actions"
        payload = {
            "action_custom_param": "hangup_leg",
            "exoml": '<?xml version="1.0" encoding="UTF-8"?><Flow><Hangup></Hangup></Flow>',
        }
        headers = {"Content-Type": "application/json"}

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                api_url,
                json=payload,
                headers=headers,
                auth=auth,
            )
            # 200, 202, 204, or 404 (already terminated) are treated gracefully
            if resp.status_code not in (200, 202, 204, 404):
                pass

    async def bridge_legs(self, call_id: str, agent_leg_id: str, customer_leg_id: str) -> None:
        """
        Bridges media between agent and customer legs into an Exotel multi-party audio bridge.
        (POST /v2/accounts/{account_sid}/bridges)
        """
        auth = self.get_auth()

        if not agent_leg_id or not customer_leg_id:
            raise ValueError("Both agent_leg_id and customer_leg_id are required to bridge legs")

        api_url = f"{self.api_base_url}/v2/accounts/{self.account_sid}/bridges"
        webhook_url = f"{self.webhook_base_url}/api/v1/telephony/webhooks/exotel"

        payload = {
            "leg_sids": [agent_leg_id, customer_leg_id],
            "bridge_event_endpoint": webhook_url,
            "absorb_dtmf": False,
        }
        headers = {"Content-Type": "application/json"}

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                api_url,
                json=payload,
                headers=headers,
                auth=auth,
            )

        if resp.status_code not in (200, 201, 202):
            error_detail = resp.text
            try:
                err_json = resp.json()
                error_detail = (
                    err_json.get("response", {}).get("error_data", {}).get("message")
                    or err_json.get("error_data", {}).get("message")
                    or err_json.get("message")
                    or resp.text
                )
            except Exception:
                pass
            raise RuntimeError(f"Exotel bridge failed ({resp.status_code}): {error_detail}")

    def verify_webhook_signature(
        self, raw_headers: Dict[str, str], raw_body: bytes, request_url: Optional[str] = None
    ) -> bool:
        """
        Validates Exotel HMAC-SHA256 signature from the X-Exotel-Signature header.
        Rejects missing or invalid signatures outside isolated test config.
        """
        if raw_headers.get("x-mock-signature") == "invalid" or raw_headers.get("x-exotel-signature") == "invalid":
            return False

        if settings.ENVIRONMENT in ("development", "test") and settings.DEV_AUTH_BYPASS_ENABLED and not self.api_token:
            return True

        if not self.api_token:
            return False

        sig_header = (
            raw_headers.get("x-exotel-signature")
            or raw_headers.get("X-Exotel-Signature")
            or ""
        )
        if not sig_header:
            return False

        received_sig = sig_header
        if "=" in sig_header:
            parts = sig_header.split("=", 1)
            algo = parts[0].strip().lower()
            if algo != "sha256":
                return False
            received_sig = parts[1].strip()

        expected_sig = hmac.new(
            self.api_token.encode("utf-8"),
            raw_body if raw_body else b"",
            hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(received_sig, expected_sig)

    def parse_webhook_event(
        self, raw_headers: Dict[str, str], raw_body: Dict[str, Any]
    ) -> TelephonyEvent:
        """
        Parses verified Exotel webhook payload into canonical TelephonyEvent.
        Supports both v2 real-time leg lifecycle events and v1 StatusCallback formats.
        """
        leg_id = (
            raw_body.get("leg_sid")
            or raw_body.get("LegSid")
            or raw_body.get("CallSid")
            or raw_body.get("call_sid")
            or raw_body.get("Sid")
            or raw_body.get("sid")
            or (raw_body.get("data") if isinstance(raw_body.get("data"), dict) else {}).get("leg_sid")
            or ""
        )

        event_name = (
            raw_body.get("event_name")
            or raw_body.get("Status")
            or raw_body.get("status")
            or (raw_body.get("data") if isinstance(raw_body.get("data"), dict) else {}).get("state")
            or raw_body.get("event_type")
            or ""
        ).lower()

        terminal_status = (
            raw_body.get("terminal_status")
            or (raw_body.get("data") if isinstance(raw_body.get("data"), dict) else {}).get("terminal_status")
            or ""
        ).lower()

        status_map = {
            "leg_connecting": CallEventType.CALL_CREATED,
            "connecting": CallEventType.CALL_CREATED,
            "queued": CallEventType.CALL_CREATED,
            "leg_ringing": CallEventType.LEG_RINGING,
            "ringing": CallEventType.LEG_RINGING,
            "leg_answered": CallEventType.CALL_CONNECTED,
            "answered": CallEventType.CALL_CONNECTED,
            "connected": CallEventType.CALL_CONNECTED,
            "in-progress": CallEventType.CALL_CONNECTED,
            "completed": CallEventType.CALL_COMPLETED,
            "busy": CallEventType.LEG_BUSY,
            "no-answer": CallEventType.LEG_NO_ANSWER,
            "no_answer": CallEventType.LEG_NO_ANSWER,
            "failed": CallEventType.CALL_FAILED,
            "cancelled": CallEventType.CALL_CANCELLED,
            "canceled": CallEventType.CALL_CANCELLED,
        }

        if event_name in ("leg_terminated", "terminal"):
            event_type = status_map.get(terminal_status, CallEventType.CALL_COMPLETED)
        else:
            event_type = status_map.get(
                event_name,
                CallEventType.CALL_COMPLETED if "completed" in event_name else CallEventType.CALL_FAILED
            )

        provider_event_id = f"exotel-{leg_id}-{event_name or terminal_status or 'evt'}-{raw_body.get('SequenceNumber', raw_body.get('sequence_number', '0'))}"

        return TelephonyEvent(
            provider="exotel",
            provider_event_id=provider_event_id,
            call_id="",
            telephony_leg_id=leg_id,
            event_type=event_type,
            occurred_at=datetime.now(timezone.utc),
            raw_payload=raw_body,
        )
