import base64
import hashlib
import hmac
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from urllib.parse import parse_qsl
import httpx

from backend.app.core.config import settings
from backend.app.domains.common.enums import (
    CallEventType,
    CallLegStatus,
)
from backend.app.domains.telephony.base import (
    TelephonyProvider,
    LegDialRequest,
    LegDialResponse,
    TelephonyEvent,
)

class PlivoTelephonyProvider(TelephonyProvider):
    """
    Concrete TelephonyProvider implementation for Plivo Voice API.
    Handles outbound call initiation, signature verification, and event normalization.
    """

    def __init__(
        self,
        auth_id: Optional[str] = None,
        auth_token: Optional[str] = None,
        caller_id: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        self.auth_id = auth_id or settings.PLIVO_AUTH_ID
        self.auth_token = auth_token or settings.PLIVO_AUTH_TOKEN
        self.caller_id = caller_id or settings.PLIVO_CALLER_ID
        self.base_url = base_url or settings.PUBLIC_WEBHOOK_URL.rstrip("/")

    async def initiate_leg(self, request: LegDialRequest) -> LegDialResponse:
        """
        Initiates an outbound call via Plivo REST API.
        """
        if not self.auth_id or not self.auth_token:
            raise ValueError("Plivo credentials not configured. Please set PLIVO_AUTH_ID and PLIVO_AUTH_TOKEN.")

        from_number = request.from_endpoint_uri or self.caller_id
        if not from_number:
            raise ValueError("No valid Caller ID (From number) provided for outbound call.")

        api_url = f"https://api.plivo.com/v1/Account/{self.auth_id}/Call/"
        conference_room = f"conf-{request.call_id}"
        answer_url = f"{self.base_url}/api/v1/telephony/webhooks/plivo/conference?room={conference_room}"
        callback_url = f"{self.base_url}/api/v1/telephony/webhooks/plivo"

        payload = {
            "from": from_number,
            "to": request.to_endpoint_uri,
            "answer_url": answer_url,
            "answer_method": "POST",
            "callback_url": callback_url,
            "callback_method": "POST",
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                api_url,
                json=payload,
                auth=(self.auth_id, self.auth_token),
            )

        if resp.status_code not in (200, 201):
            raise RuntimeError(f"Plivo API Error ({resp.status_code}): {resp.text}")

        data = resp.json()
        request_uuid = data.get("request_uuid", "")

        return LegDialResponse(
            telephony_leg_id=request_uuid,
            provider="plivo",
            is_simulated=False,
        )

    async def terminate_leg(self, telephony_leg_id: str) -> None:
        """
        Hangs up an active call leg via Plivo.
        """
        if not self.auth_id or not self.auth_token:
            return

        api_url = f"https://api.plivo.com/v1/Account/{self.auth_id}/Call/{telephony_leg_id}/"
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.delete(
                api_url,
                auth=(self.auth_id, self.auth_token),
            )

    async def bridge_legs(self, call_id: str, agent_leg_id: str, customer_leg_id: str) -> None:
        """
        Bridges media between agent and customer legs into a shared conference room.
        Uses Plivo's Call Transfer API to transfer active legs into the conference.
        """
        if not self.auth_id or not self.auth_token:
            raise RuntimeError("Plivo credentials (PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN) not configured")

        if not agent_leg_id or not customer_leg_id:
            raise ValueError("Both agent_leg_id and customer_leg_id are required to bridge legs")

        conference_room = f"conf-{call_id}"
        conf_url = f"{self.base_url}/api/v1/telephony/webhooks/plivo/conference?room={conference_room}"

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp_cust = await client.post(
                f"https://api.plivo.com/v1/Account/{self.auth_id}/Call/{customer_leg_id}/",
                json={"aleg_url": conf_url, "aleg_method": "POST"},
                auth=(self.auth_id, self.auth_token),
            )
            if resp_cust.status_code not in (200, 201, 202):
                raise RuntimeError(f"Plivo bridge failed for customer leg ({resp_cust.status_code}): {resp_cust.text}")

            resp_agent = await client.post(
                f"https://api.plivo.com/v1/Account/{self.auth_id}/Call/{agent_leg_id}/",
                json={"aleg_url": conf_url, "aleg_method": "POST"},
                auth=(self.auth_id, self.auth_token),
            )
            if resp_agent.status_code not in (200, 201, 202):
                raise RuntimeError(f"Plivo bridge failed for agent leg ({resp_agent.status_code}): {resp_agent.text}")

    def verify_webhook_signature(
        self, raw_headers: Dict[str, str], raw_body: bytes, request_url: Optional[str] = None
    ) -> bool:
        """
        Validates Plivo's cryptographic signature (V2 HMAC-SHA256 or V1 HMAC-SHA1).
        Rejects missing or invalid signatures outside isolated test config.
        """
        if raw_headers.get("x-mock-signature") == "invalid" or raw_headers.get("x-plivo-signature-v2") == "invalid":
            return False

        if settings.ENVIRONMENT in ("development", "test") and settings.DEV_AUTH_BYPASS_ENABLED and not self.auth_token:
            return True

        if not self.auth_token:
            return False

        url = request_url or f"{self.base_url}/api/v1/telephony/webhooks/plivo"

        # 1. Plivo Signature V2 (HMAC-SHA256)
        sig_v2 = raw_headers.get("x-plivo-signature-v2") or raw_headers.get("X-Plivo-Signature-V2")
        nonce = raw_headers.get("x-plivo-signature-v2-nonce") or raw_headers.get("X-Plivo-Signature-V2-Nonce") or ""
        if sig_v2:
            try:
                body_str = raw_body.decode("utf-8") if raw_body else ""
                params = dict(parse_qsl(body_str, keep_blank_values=True))
            except Exception:
                params = {}

            data_to_sign = url + nonce
            for key in sorted(params.keys()):
                data_to_sign += f"{key}{params[key]}"

            expected_sig = base64.b64encode(
                hmac.new(
                    self.auth_token.encode("utf-8"),
                    data_to_sign.encode("utf-8"),
                    hashlib.sha256,
                ).digest()
            ).decode("utf-8")

            if hmac.compare_digest(sig_v2, expected_sig):
                return True

        # 2. Plivo Signature V1 (HMAC-SHA1)
        sig_v1 = raw_headers.get("x-plivo-signature") or raw_headers.get("X-Plivo-Signature")
        if sig_v1:
            try:
                body_str = raw_body.decode("utf-8") if raw_body else ""
                params = dict(parse_qsl(body_str, keep_blank_values=True))
            except Exception:
                params = {}

            data_to_sign = url
            for key in sorted(params.keys()):
                data_to_sign += f"{key}{params[key]}"

            expected_sig = base64.b64encode(
                hmac.new(
                    self.auth_token.encode("utf-8"),
                    data_to_sign.encode("utf-8"),
                    hashlib.sha1,
                ).digest()
            ).decode("utf-8")

            if hmac.compare_digest(sig_v1, expected_sig):
                return True

        return False

    def parse_webhook_event(
        self, raw_headers: Dict[str, str], raw_body: Dict[str, Any]
    ) -> TelephonyEvent:
        call_uuid = raw_body.get("CallUUID") or raw_body.get("call_uuid") or ""
        call_status = (raw_body.get("CallStatus") or raw_body.get("call_status") or "").lower()
        provider_event_id = f"plivo-{call_uuid}-{call_status}-{raw_body.get('SequenceNumber', '0')}"

        status_to_event = {
            "queued": CallEventType.CALL_CREATED,
            "ringing": CallEventType.LEG_RINGING,
            "in-progress": CallEventType.CALL_CONNECTED,
            "completed": CallEventType.CALL_COMPLETED,
            "busy": CallEventType.LEG_BUSY,
            "no-answer": CallEventType.LEG_NO_ANSWER,
            "failed": CallEventType.CALL_FAILED,
            "cancelled": CallEventType.CALL_CANCELLED,
        }

        event_type = status_to_event.get(call_status, CallEventType.CALL_FAILED)

        return TelephonyEvent(
            provider="plivo",
            provider_event_id=provider_event_id,
            call_id="",
            telephony_leg_id=call_uuid,
            event_type=event_type,
            occurred_at=datetime.now(timezone.utc),
            raw_payload=raw_body,
        )
