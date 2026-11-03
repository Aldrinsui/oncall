from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Dict, Any
from backend.app.domains.common.enums import CallLegRole, CallEventType

@dataclass(frozen=True)
class LegDialRequest:
    call_id: str
    leg_role: CallLegRole
    attempt_number: int
    to_endpoint_type: str        # 'WEBRTC', 'SIP', 'PSTN'
    to_endpoint_uri: str         # e.g. 'webrtc:agent-dev', 'sip:agent@dev.internal', '+919876543210'
    from_endpoint_type: str      # 'WEBRTC', 'SIP', 'PSTN'
    from_endpoint_uri: str
    callback_url: str

@dataclass(frozen=True)
class LegDialResponse:
    telephony_leg_id: str
    provider: str
    is_simulated: bool

@dataclass(frozen=True)
class TelephonyEvent:
    provider: str
    provider_event_id: str
    call_id: str
    telephony_leg_id: Optional[str]
    event_type: CallEventType
    occurred_at: datetime       # Timezone-aware timestamp from provider network
    raw_payload: Dict[str, Any]

class TelephonyProvider(ABC):
    @abstractmethod
    async def initiate_leg(self, request: LegDialRequest) -> LegDialResponse:
        """Dispatches an outbound call leg. Returns external leg identifier."""
        pass

    @abstractmethod
    async def terminate_leg(self, telephony_leg_id: str) -> None:
        """Terminates an individual active or ringing call leg."""
        pass

    @abstractmethod
    async def bridge_legs(self, call_id: str, agent_leg_id: str, customer_leg_id: str) -> None:
        """Bridges media between two answered legs (agent and customer)."""
        pass

    @abstractmethod
    def verify_webhook_signature(self, raw_headers: Dict[str, str], raw_body: bytes) -> bool:
        """Validates provider signature against raw request bytes before JSON parsing."""
        pass

    @abstractmethod
    def parse_webhook_event(self, raw_headers: Dict[str, str], raw_body: Dict[str, Any]) -> TelephonyEvent:
        """Parses verified webhook payload into canonical TelephonyEvent."""
        pass
