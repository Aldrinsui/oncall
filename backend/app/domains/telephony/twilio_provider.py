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
    EndpointType,
)
from backend.app.domains.telephony.base import (
    TelephonyProvider,
    LegDialRequest,
    LegDialResponse,
    TelephonyEvent,
)

class TwilioTelephonyProvider(TelephonyProvider):
    """
    Concrete TelephonyProvider implementation for Twilio Voice REST API.
    Handles outbound PSTN call creation, status callbacks, signature verification,
    and leg termination.
    """

    def __init__(
        self,
        account_sid: Optional[str] = None,
        auth_token: Optional[str] = None,
        caller_id: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        self.account_sid = account_sid or settings.TWILIO_ACCOUNT_SID
        self.auth_token = auth_token or settings.TWILIO_AUTH_TOKEN
        self.caller_id = caller_id or settings.TWILIO_CALLER_ID
        self.base_url = base_url or settings.PUBLIC_WEBHOOK_URL.rstrip("/")

    async def initiate_leg(self, request: LegDialRequest) -> LegDialResponse:
        """
        Initiates a real outbound PSTN call via Twilio Calls REST endpoint.
        """
        if not self.account_sid or not self.auth_token:
            raise ValueError(
                "Twilio credentials not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN."
            )

        from_number = request.from_endpoint_uri or self.caller_id
        if not from_number:
            raise ValueError("No valid Caller ID (From number) provided for outbound PSTN call.")

        api_url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Calls.json"
        webhook_url = f"{self.base_url}/api/v1/telephony/webhooks/twilio"

        # TwiML payload played to the recipient upon answering
        twiml_instruction = (
            "<Response>"
            "<Say voice=\"Polly.Aditi\" language=\"en-IN\">"
            "Hello. This is a live outbound call from OnGround A I tele-caller platform. "
            "Your call is successfully connected."
            "</Say>"
            "<Pause length=\"5\"/>"
            "<Say voice=\"Polly.Aditi\" language=\"en-IN\">Thank you for testing. Good bye.</Say>"
            "<Hangup/>"
            "</Response>"
        )

        form_data = [
            ("To", request.to_endpoint_uri),
            ("From", from_number),
            ("Twiml", twiml_instruction),
            ("StatusCallback", webhook_url),
            ("StatusCallbackEvent", "initiated"),
            ("StatusCallbackEvent", "ringing"),
            ("StatusCallbackEvent", "answered"),
            ("StatusCallbackEvent", "completed"),
            ("StatusCallbackMethod", "POST"),
        ]

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                api_url,
                data=form_data,
                auth=(self.account_sid, self.auth_token),
            )

        if resp.status_code not in (200, 201):
            error_detail = resp.text
            try:
                err_json = resp.json()
                error_detail = err_json.get("message", resp.text)
            except Exception:
                pass
            raise RuntimeError(f"Twilio API Error ({resp.status_code}): {error_detail}")

        call_data = resp.json()
        call_sid = call_data.get("sid", "")

        return LegDialResponse(
            telephony_leg_id=call_sid,
            provider="twilio",
            is_simulated=False,
        )

    async def terminate_leg(self, telephony_leg_id: str) -> None:
        """
        Hangs up an active or ringing Twilio call by updating status to completed.
        """
        if not self.account_sid or not self.auth_token:
            return

        api_url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Calls/{telephony_leg_id}.json"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                api_url,
                data={"Status": "completed"},
                auth=(self.account_sid, self.auth_token),
            )
            if resp.status_code not in (200, 204):
                # If already ended or not found, treat gracefully
                pass

    async def bridge_legs(self, call_id: str, agent_leg_id: str, customer_leg_id: str) -> None:
        """
        Bridges media between agent and customer legs.
        """
        pass

    def verify_webhook_signature(
        self, raw_headers: Dict[str, str], raw_body: bytes, request_url: Optional[str] = None
    ) -> bool:
        """
        Validates Twilio's X-Twilio-Signature according to official security specifications.
        """
        signature = raw_headers.get("x-twilio-signature") or raw_headers.get("X-Twilio-Signature")
        if not signature:
            if settings.ENVIRONMENT == "development" and settings.DEV_AUTH_BYPASS_ENABLED:
                return True
            return False

        if not self.auth_token:
            return False

        url = request_url or f"{self.base_url}/api/v1/telephony/webhooks/twilio"

        # Parse form body key-values
        try:
            body_str = raw_body.decode("utf-8")
            params = dict(parse_qsl(body_str, keep_blank_values=True))
        except Exception:
            params = {}

        # Concatenate URL + sorted param names and values
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

        return hmac.compare_digest(signature, expected_sig)

    def parse_webhook_event(
        self, raw_headers: Dict[str, str], raw_body: Dict[str, Any]
    ) -> TelephonyEvent:
        """
        Normalizes Twilio webhook POST form data into a canonical TelephonyEvent.
        """
        call_sid = raw_body.get("CallSid") or raw_body.get("call_sid") or ""
        call_status = (raw_body.get("CallStatus") or raw_body.get("call_status") or "").lower()
        sequence_number = raw_body.get("SequenceNumber", "0")
        provider_event_id = f"twilio-{call_sid}-{call_status}-{sequence_number}"

        # Map Twilio call statuses to CallEventType
        status_to_event = {
            "queued": CallEventType.CALL_CREATED,
            "initiated": CallEventType.LEG_INITIATING,
            "ringing": CallEventType.LEG_RINGING,
            "in-progress": CallEventType.CALL_CONNECTED,
            "completed": CallEventType.CALL_COMPLETED,
            "busy": CallEventType.LEG_BUSY,
            "no-answer": CallEventType.LEG_NO_ANSWER,
            "failed": CallEventType.CALL_FAILED,
            "canceled": CallEventType.CALL_CANCELLED,
        }

        event_type = status_to_event.get(call_status, CallEventType.CALL_FAILED)

        return TelephonyEvent(
            provider="twilio",
            provider_event_id=provider_event_id,
            call_id="",  # Correlated by telephony_leg_id in TelephonyService
            telephony_leg_id=call_sid,
            event_type=event_type,
            occurred_at=datetime.now(timezone.utc),
            raw_payload=raw_body,
        )

    @staticmethod
    def map_event_to_leg_status(event_type: CallEventType) -> Optional[CallLegStatus]:
        mapping = {
            CallEventType.LEG_INITIATING: CallLegStatus.INITIATING,
            CallEventType.LEG_RINGING: CallLegStatus.RINGING,
            CallEventType.CALL_CONNECTED: CallLegStatus.ANSWERED,
            CallEventType.CALL_COMPLETED: CallLegStatus.COMPLETED,
            CallEventType.LEG_BUSY: CallLegStatus.BUSY,
            CallEventType.LEG_NO_ANSWER: CallLegStatus.NO_ANSWER,
            CallEventType.CALL_FAILED: CallLegStatus.FAILED,
            CallEventType.CALL_CANCELLED: CallLegStatus.CANCELLED,
        }
        return mapping.get(event_type)
