import base64
import hashlib
import hmac
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from urllib.parse import parse_qsl, urlencode
import httpx

from backend.app.core.config import settings
from backend.app.domains.common.enums import (
    CallEventType,
    CallLegRole,
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
        api_key_sid: Optional[str] = None,
        api_key_secret: Optional[str] = None,
        agent_caller_id: Optional[str] = None,
        customer_caller_id: Optional[str] = None,
    ):
        self.account_sid = account_sid if account_sid is not None else settings.TWILIO_ACCOUNT_SID
        self.auth_token = auth_token if auth_token is not None else settings.TWILIO_AUTH_TOKEN
        self.api_key_sid = api_key_sid if api_key_sid is not None else settings.TWILIO_API_KEY_SID
        self.api_key_secret = api_key_secret if api_key_secret is not None else settings.TWILIO_API_KEY_SECRET
        self.caller_id = caller_id if caller_id is not None else settings.TWILIO_CALLER_ID
        self.agent_caller_id = agent_caller_id if agent_caller_id is not None else settings.TWILIO_AGENT_CALLER_ID
        self.customer_caller_id = customer_caller_id if customer_caller_id is not None else settings.TWILIO_CUSTOMER_CALLER_ID
        self.base_url = (base_url or settings.PUBLIC_WEBHOOK_URL).rstrip("/")

    def __repr__(self) -> str:
        key_status = "configured" if (self.api_key_sid and self.api_key_secret) else "not configured"
        token_status = "configured" if self.auth_token else "not configured"
        return f"<TwilioTelephonyProvider account_sid={self.account_sid!r} api_key={key_status} auth_token={token_status}>"

    def get_rest_auth(self) -> tuple[str, str]:
        """
        Validates and returns the HTTP Basic Auth tuple (username, password) for Twilio REST API requests.

        Rules:
        1. TWILIO_ACCOUNT_SID is required for all REST operations (URL path).
        2. If both TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET are provided, returns (api_key_sid, api_key_secret).
        3. If only one of TWILIO_API_KEY_SID or TWILIO_API_KEY_SECRET is provided, raises ValueError.
           Incomplete API key pairs are rejected immediately and NEVER silently fall back to TWILIO_AUTH_TOKEN.
        4. If neither API key is provided, falls back to (account_sid, auth_token) if auth_token is provided.
        5. If neither API key pair nor auth_token is provided, raises ValueError.
        """
        if not self.account_sid or not self.account_sid.strip():
            raise ValueError(
                "Twilio credentials not configured: TWILIO_ACCOUNT_SID is required for REST operations."
            )

        has_key_sid = bool(self.api_key_sid and self.api_key_sid.strip())
        has_key_secret = bool(self.api_key_secret and self.api_key_secret.strip())

        if has_key_sid != has_key_secret:
            raise ValueError(
                "Incomplete Twilio API Key configuration: both TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET "
                "must be provided together. Incomplete API key pairs are rejected and will not fall back to TWILIO_AUTH_TOKEN."
            )

        if has_key_sid and has_key_secret:
            return (self.api_key_sid.strip(), self.api_key_secret.strip())

        if self.auth_token and self.auth_token.strip():
            return (self.account_sid.strip(), self.auth_token.strip())

        raise ValueError(
            "Twilio REST credentials not configured: please set TWILIO_ACCOUNT_SID and either "
            "(TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET) or TWILIO_AUTH_TOKEN."
        )

    def validate_credentials(self) -> None:
        """Validates that credentials for REST operations are properly configured."""
        self.get_rest_auth()

    async def initiate_leg(self, request: LegDialRequest) -> LegDialResponse:
        """
        Initiates a real outbound PSTN call via Twilio Calls REST endpoint.
        """
        auth = self.get_rest_auth()

        from_number = request.from_endpoint_uri
        if not from_number:
            if request.leg_role == CallLegRole.AGENT:
                from_number = self.agent_caller_id or self.caller_id
            elif request.leg_role == CallLegRole.CUSTOMER:
                from_number = self.customer_caller_id or self.caller_id
            else:
                from_number = self.caller_id

        if not from_number:
            raise ValueError("No valid Caller ID (From number) provided for outbound PSTN call.")

        api_url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Calls.json"
        webhook_url = f"{self.base_url}/api/v1/telephony/webhooks/twilio"

        # TwiML payload connecting recipient into shared conference room upon answering
        conference_room = f"conf-{request.call_id}"
        twiml_instruction = (
            f"<Response><Dial><Conference beep=\"false\" startConferenceOnEnter=\"true\" "
            f"endConferenceOnExit=\"true\">{conference_room}</Conference></Dial></Response>"
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

        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        encoded_data = urlencode(form_data).encode("utf-8")

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                api_url,
                content=encoded_data,
                headers=headers,
                auth=auth,
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
        auth = self.get_rest_auth()

        if not telephony_leg_id:
            return

        api_url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Calls/{telephony_leg_id}.json"
        encoded = urlencode({"Status": "completed"}).encode("utf-8")
        headers = {"Content-Type": "application/x-www-form-urlencoded"}

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                api_url,
                content=encoded,
                headers=headers,
                auth=auth,
            )
            if resp.status_code not in (200, 204):
                # If already ended or not found, treat gracefully
                pass

    async def bridge_legs(self, call_id: str, agent_leg_id: str, customer_leg_id: str) -> None:
        """
        Bridges media between agent and customer legs into a shared conference room.
        Uses Twilio's Calls API to update active legs with conference TwiML.
        """
        auth = self.get_rest_auth()

        if not agent_leg_id or not customer_leg_id:
            raise ValueError("Both agent_leg_id and customer_leg_id are required to bridge legs")

        conference_room = f"conf-{call_id}"
        bridge_twiml = (
            f"<Response><Dial><Conference beep=\"false\" startConferenceOnEnter=\"true\" "
            f"endConferenceOnExit=\"true\">{conference_room}</Conference></Dial></Response>"
        )
        encoded = urlencode({"Twiml": bridge_twiml}).encode("utf-8")
        headers = {"Content-Type": "application/x-www-form-urlencoded"}

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp_cust = await client.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Calls/{customer_leg_id}.json",
                content=encoded,
                headers=headers,
                auth=auth,
            )
            if resp_cust.status_code not in (200, 201):
                raise RuntimeError(f"Twilio bridge failed for customer leg ({resp_cust.status_code}): {resp_cust.text}")

            resp_agent = await client.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Calls/{agent_leg_id}.json",
                content=encoded,
                headers=headers,
                auth=auth,
            )
            if resp_agent.status_code not in (200, 201):
                raise RuntimeError(f"Twilio bridge failed for agent leg ({resp_agent.status_code}): {resp_agent.text}")

    def verify_webhook_signature(
        self, raw_headers: Dict[str, str], raw_body: bytes, request_url: Optional[str] = None
    ) -> bool:
        """
        Validates Twilio's X-Twilio-Signature according to official security specifications.
        Twilio webhook signatures are always verified using the primary Account Auth Token (HMAC-SHA1),
        regardless of whether REST API operations use Restricted API Keys.
        """
        if raw_headers.get("x-mock-signature") == "invalid" or raw_headers.get("x-twilio-signature") == "invalid":
            return False

        signature = raw_headers.get("x-twilio-signature") or raw_headers.get("X-Twilio-Signature")
        if not signature:
            if settings.ENVIRONMENT in ("development", "test") and settings.DEV_AUTH_BYPASS_ENABLED and not self.auth_token:
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
