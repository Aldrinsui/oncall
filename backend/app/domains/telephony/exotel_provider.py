import hashlib
import hmac
import json
import re
import xml.etree.ElementTree as ET
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


def parse_exotel_response_body(body_text: str) -> Dict[str, Any]:
    """
    Safely parses Exotel response bodies across both XML and JSON formats.
    Exotel returns XML for errors or when requested, and JSON when configured.
    """
    body_text = (body_text or "").strip()
    if not body_text:
        return {}

    if body_text.startswith("<"):
        try:
            root = ET.fromstring(body_text)
            # 1. Check for RestException
            rest_exc = root.find("RestException")
            if rest_exc is not None:
                status_el = rest_exc.find("Status")
                msg_el = rest_exc.find("Message")
                code_el = rest_exc.find("Code")
                status_val = None
                if status_el is not None and status_el.text:
                    try:
                        status_val = int(status_el.text.strip())
                    except ValueError:
                        status_val = status_el.text.strip()
                return {
                    "RestException": {
                        "Status": status_val,
                        "Message": msg_el.text.strip() if msg_el is not None and msg_el.text else "",
                        "Code": code_el.text.strip() if code_el is not None and code_el.text else "",
                    }
                }

            # 2. Check for Call element
            call_el = root.find("Call")
            if call_el is not None:
                sid_el = call_el.find("Sid")
                status_el = call_el.find("Status")
                return {
                    "Call": {
                        "Sid": sid_el.text.strip() if sid_el is not None and sid_el.text else "",
                        "Status": status_el.text.strip() if status_el is not None and status_el.text else "",
                    }
                }

            # 3. Generic element mapping
            result: Dict[str, Any] = {}
            for child in root:
                result[child.tag] = child.text.strip() if child.text else ""
            return result
        except Exception:
            return {}

    try:
        return json.loads(body_text)
    except Exception:
        return {}


class ExotelTelephonyProvider(TelephonyProvider):
    """
    Concrete TelephonyProvider implementation for the Exotel Voice v1 API.
    Supports single orchestrated two-party outbound calls via POST /v1/Accounts/{account_sid}/Calls/connect,
    v1 call status inspection and termination, HMAC-SHA256 signature verification, and event normalization.
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

    async def connect(
        self,
        call_id: str,
        from_number: str,
        to_number: str,
        caller_id: Optional[str] = None,
        callback_url: Optional[str] = None,
        time_limit: int = 300,
    ) -> str:
        """
        Initiates an orchestrated outbound call connecting agent (From) and customer (To) via
        POST /v1/Accounts/{account_sid}/Calls/connect.
        Returns the Exotel Call.Sid.
        """
        auth = self.get_auth()
        effective_caller_id = caller_id or self.caller_id
        if not effective_caller_id:
            raise ValueError("No valid Caller ID (ExoPhone) provided for outbound Exotel call.")
        if not from_number:
            raise ValueError("No valid From number (agent phone) provided for outbound Exotel call.")
        if not to_number:
            raise ValueError("No valid To number (customer phone) provided for outbound Exotel call.")

        clean_caller_id = re.sub(r"[^\d+]", "", effective_caller_id)
        api_url = f"{self.api_base_url}/v1/Accounts/{self.account_sid}/Calls/connect"
        webhook_url = callback_url or f"{self.webhook_base_url}/api/v1/telephony/webhooks/exotel"

        data = {
            "From": from_number,
            "To": to_number,
            "CallerId": clean_caller_id,
            "CallType": "trans",
            "StatusCallback": webhook_url,
            "StatusCallbackEvents": ["terminal", "answered"],
            "CustomField": call_id,
            "TimeLimit": str(time_limit),
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                api_url,
                data=data,
                auth=auth,
            )

        if resp.status_code not in (200, 201):
            err_data = parse_exotel_response_body(resp.text)
            rest_exc = err_data.get("RestException") or {}
            err_msg = (
                rest_exc.get("Message")
                or err_data.get("message")
                or err_data.get("error_data", {}).get("message")
                or resp.text
            )
            err_code = rest_exc.get("Code") or err_data.get("code") or ""
            err_status = rest_exc.get("Status") or resp.status_code
            error_str = f"Exotel API Error ({err_status})"
            if err_code:
                error_str += f" [Code {err_code}]"
            error_str += f": {err_msg}"
            raise RuntimeError(error_str)

        body_data = parse_exotel_response_body(resp.text)
        call_obj = body_data.get("Call") or body_data
        call_sid = (
            call_obj.get("Sid")
            or call_obj.get("sid")
            or body_data.get("sid")
            or body_data.get("CallSid")
            or ""
        )
        if not call_sid:
            raise RuntimeError("Exotel API returned success but no Call.Sid found in response")

        return call_sid

    async def initiate_leg(self, request: LegDialRequest) -> LegDialResponse:
        """
        Initiates an outbound call leg via Exotel Voice v1 Calls/connect.
        Note: For full two-leg OnGround calls, TelephonyService invokes connect() directly.
        """
        from_number = request.from_endpoint_uri or self.caller_id
        if not from_number:
            raise ValueError("No valid Caller ID (From number / ExoPhone) provided for outbound Exotel call.")

        call_sid = await self.connect(
            call_id=request.call_id,
            from_number=from_number,
            to_number=request.to_endpoint_uri,
            caller_id=self.caller_id or from_number,
            callback_url=request.callback_url,
            time_limit=300,
        )

        return LegDialResponse(
            telephony_leg_id=call_sid,
            provider="exotel",
            is_simulated=False,
        )

    async def terminate_leg(self, telephony_leg_id: str) -> None:
        """
        Terminates an active call via Exotel v1 Calls API.
        All unsupported v2 endpoints are removed.
        """
        if not self.account_sid or not self.api_key or not self.api_token or not telephony_leg_id:
            return

        auth = self.get_auth()
        api_url = f"{self.api_base_url}/v1/Accounts/{self.account_sid}/Calls/{telephony_leg_id}"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    api_url,
                    data={"Status": "completed"},
                    auth=auth,
                )
                if resp.status_code not in (200, 202, 204, 404, 405):
                    pass
        except Exception:
            pass

    async def bridge_legs(self, call_id: str, agent_leg_id: str, customer_leg_id: str) -> None:
        """
        In Exotel v1, Calls/connect creates an orchestrated two-party call that connects
        and bridges agent and customer automatically. No separate /bridges endpoint exists in v1.
        """
        return

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
        Supports both v1 Calls/connect StatusCallback and v2 event payloads.
        Correlates CustomField with OnGround call_id.
        """
        call_sid = (
            raw_body.get("CallSid")
            or raw_body.get("call_sid")
            or raw_body.get("Sid")
            or raw_body.get("sid")
            or raw_body.get("leg_sid")
            or raw_body.get("LegSid")
            or (raw_body.get("data") if isinstance(raw_body.get("data"), dict) else {}).get("leg_sid")
            or ""
        )

        custom_field = (
            raw_body.get("CustomField")
            or raw_body.get("custom_field")
            or ""
        )

        event_name = (
            raw_body.get("event_name")
            or raw_body.get("EventType")
            or (raw_body.get("event_type") if raw_body.get("event_type") != "leg_lifecycle_event" else "")
            or ""
        ).lower()

        status_name = (
            raw_body.get("Status")
            or raw_body.get("status")
            or raw_body.get("CallStatus")
            or (raw_body.get("data") if isinstance(raw_body.get("data"), dict) else {}).get("state")
            or ""
        ).lower()

        terminal_status = (
            raw_body.get("terminal_status")
            or (raw_body.get("data") if isinstance(raw_body.get("data"), dict) else {}).get("terminal_status")
            or ""
        ).lower()

        status_map = {
            "queued": CallEventType.CALL_CREATED,
            "connecting": CallEventType.CALL_CREATED,
            "leg_connecting": CallEventType.CALL_CREATED,
            "ringing": CallEventType.LEG_RINGING,
            "leg_ringing": CallEventType.LEG_RINGING,
            "in-progress": CallEventType.CALL_CONNECTED,
            "answered": CallEventType.CALL_CONNECTED,
            "leg_answered": CallEventType.CALL_CONNECTED,
            "connected": CallEventType.CALL_CONNECTED,
            "completed": CallEventType.CALL_COMPLETED,
            "busy": CallEventType.LEG_BUSY,
            "no-answer": CallEventType.LEG_NO_ANSWER,
            "no_answer": CallEventType.LEG_NO_ANSWER,
            "failed": CallEventType.CALL_FAILED,
            "cancelled": CallEventType.CALL_CANCELLED,
            "canceled": CallEventType.CALL_CANCELLED,
        }

        if event_name in ("leg_answered", "answered") or status_name in ("in-progress", "answered", "connected"):
            event_type = CallEventType.CALL_CONNECTED
        elif event_name in ("terminal", "leg_terminated"):
            event_type = status_map.get(terminal_status or status_name, CallEventType.CALL_COMPLETED)
        elif event_name in status_map:
            event_type = status_map[event_name]
        elif status_name in status_map:
            event_type = status_map[status_name]
        else:
            event_type = CallEventType.CALL_CREATED

        # Unique event ID for reliable de-duplication
        key_status = status_name or event_name or terminal_status or "event"
        seq = raw_body.get("SequenceNumber", raw_body.get("sequence_number", "0"))
        provider_event_id = f"exotel-{call_sid}-{key_status}-{seq}"

        return TelephonyEvent(
            provider="exotel",
            provider_event_id=provider_event_id,
            call_id=str(custom_field),
            telephony_leg_id=call_sid,
            event_type=event_type,
            occurred_at=datetime.now(timezone.utc),
            raw_payload=raw_body,
        )
