import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

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

class MockTelephonyProvider(TelephonyProvider):
    """
    Mock TelephonyProvider for offline testing and deterministic unit test execution.
    Records dispatched calls and allows programmed simulation.
    """

    def __init__(self):
        self.dispatched_legs: List[LegDialRequest] = []
        self.terminated_legs: List[str] = []
        self.bridged_legs: List[Dict[str, str]] = []
        self.should_fail: bool = False
        self.failure_message: str = "Simulated network failure"
        self.bridge_should_fail: bool = False
        self.bridge_failure_message: str = "Simulated bridge failure"

    async def initiate_leg(self, request: LegDialRequest) -> LegDialResponse:
        if self.should_fail:
            raise RuntimeError(self.failure_message)

        self.dispatched_legs.append(request)
        telephony_leg_id = f"mock-leg-{uuid.uuid4()}"
        return LegDialResponse(
            telephony_leg_id=telephony_leg_id,
            provider="mock",
            is_simulated=True,
        )

    async def terminate_leg(self, telephony_leg_id: str) -> None:
        self.terminated_legs.append(telephony_leg_id)

    async def bridge_legs(self, call_id: str, agent_leg_id: str, customer_leg_id: str) -> None:
        if self.bridge_should_fail:
            raise RuntimeError(self.bridge_failure_message)
        if not agent_leg_id or not customer_leg_id:
            raise ValueError("Both agent_leg_id and customer_leg_id are required.")
        self.bridged_legs.append({
            "call_id": call_id,
            "agent_leg_id": agent_leg_id,
            "customer_leg_id": customer_leg_id,
        })

    def verify_webhook_signature(
        self, raw_headers: Dict[str, str], raw_body: bytes, request_url: Optional[str] = None
    ) -> bool:
        # Mock validates presence of signature or test header
        auth_hdr = raw_headers.get("x-mock-signature") or raw_headers.get("X-Mock-Signature")
        if auth_hdr == "invalid":
            return False
        return True

    def parse_webhook_event(
        self, raw_headers: Dict[str, str], raw_body: Dict[str, Any]
    ) -> TelephonyEvent:
        call_id = raw_body.get("call_id", "")
        leg_id = raw_body.get("telephony_leg_id")
        event_str = raw_body.get("event_type", "CALL_CONNECTED")
        event_type = getattr(CallEventType, event_str, CallEventType.CALL_CONNECTED)
        event_id = raw_body.get("provider_event_id", f"mock-evt-{uuid.uuid4()}")

        return TelephonyEvent(
            provider="mock",
            provider_event_id=event_id,
            call_id=call_id,
            telephony_leg_id=leg_id,
            event_type=event_type,
            occurred_at=datetime.now(timezone.utc),
            raw_payload=raw_body,
        )
