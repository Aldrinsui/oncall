import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.core.config import settings
from backend.app.domains.common.enums import (
    CallStatus,
    CallDirection,
    CallLegRole,
    CallLegStatus,
    CallEventType,
    EndpointType,
)
from backend.app.domains.common.validation import validate_e164
from backend.app.domains.telephony.base import (
    TelephonyProvider,
    LegDialRequest,
    TelephonyEvent,
)
from backend.app.domains.telephony.state_machine import CallStateMachine
from backend.app.domains.telephony.provider_factory import get_telephony_provider
from backend.app.models.telephony import CallModel, CallLegModel, CallEventModel

def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

class TelephonyService:
    def __init__(self, db: AsyncSession, provider: Optional[TelephonyProvider] = None):
        self.db = db
        self.provider = provider or get_telephony_provider()

    async def initiate_call(
        self,
        agent_id: uuid.UUID,
        customer_id: uuid.UUID,
        customer_phone: str,
        customer_name: str = "Customer",
        direction: CallDirection = CallDirection.OUTBOUND,
        lead_id: Optional[uuid.UUID] = None,
        notes: Optional[str] = None,
        agent_endpoint_uri: Optional[str] = None,
    ) -> CallModel:
        """
        Initiates a real PSTN outbound call flow:
        1. Validates destination E.164 phone number.
        2. Persists Call and CallLeg records in database.
        3. Invokes the active TelephonyProvider to dial destination.
        4. Correlates provider leg ID with the persistent records.
        """
        # Validate E.164 phone format
        validate_e164(customer_phone, "customer_phone")

        now = datetime.now(timezone.utc)
        call_id = uuid.uuid4()
        idempotency_key = f"call-{call_id}"

        from_phone = settings.DEV_AGENT_PHONE or "+919000000001"
        is_simulated = settings.TELEPHONY_PROVIDER.lower() == "mock"

        # 1. Create Call record in INITIATING state
        call = CallModel(
            id=call_id,
            agent_id=agent_id,
            customer_id=customer_id,
            lead_id=lead_id,
            customer_name=customer_name,
            customer_phone=customer_phone,
            direction=direction.value,
            status=CallStatus.INITIATING,
            is_simulated=is_simulated,
            idempotency_key=idempotency_key,
            request_fingerprint=f"fp-{call_id}",
            notes=notes,
            created_at=now,
            initiated_at=now,
        )

        # 2. Create customer leg
        customer_leg = CallLegModel(
            id=uuid.uuid4(),
            call_id=call_id,
            leg_role=CallLegRole.CUSTOMER,
            attempt_number=1,
            provider=settings.TELEPHONY_PROVIDER,
            to_endpoint_type="PSTN",
            to_endpoint_uri=customer_phone,
            from_endpoint_type="PSTN",
            from_endpoint_uri=from_phone,
            status=CallLegStatus.INITIATING,
            initiated_at=now,
        )

        self.db.add(call)
        self.db.add(customer_leg)
        await self.db.flush()

        # 3. Dispatch outbound call through real telephony provider
        dial_req = LegDialRequest(
            call_id=str(call_id),
            leg_role=CallLegRole.CUSTOMER,
            attempt_number=1,
            to_endpoint_type=EndpointType.PSTN,
            to_endpoint_uri=customer_phone,
            from_endpoint_type=EndpointType.PSTN,
            from_endpoint_uri=from_phone,
            callback_url=f"{settings.PUBLIC_WEBHOOK_URL.rstrip('/')}/api/v1/telephony/webhooks/{settings.TELEPHONY_PROVIDER}",
        )

        try:
            dial_res = await self.provider.initiate_leg(dial_req)
            customer_leg.telephony_leg_id = dial_res.telephony_leg_id
            customer_leg.provider = dial_res.provider
            customer_leg.status = CallLegStatus.RINGING

            # Transition parent call to CUSTOMER_RINGING
            call.status = CallStateMachine.transition(call.status, CallStatus.CUSTOMER_RINGING)

            # Record initiating event
            event = CallEventModel(
                id=uuid.uuid4(),
                call_id=call_id,
                event_source="PROVIDER",
                provider=dial_res.provider,
                provider_event_id=f"{dial_res.telephony_leg_id}-initiated",
                event_type=CallEventType.LEG_INITIATING,
                payload={"telephony_leg_id": dial_res.telephony_leg_id, "to": customer_phone},
                occurred_at=now,
                received_at=now,
            )
            self.db.add(event)
            await self.db.commit()
            return await self.get_call_by_id(call_id)

        except Exception as ex:
            # If provider fails to dial, mark call & leg as FAILED
            call.status = CallStatus.FAILED
            customer_leg.status = CallLegStatus.FAILED
            customer_leg.error_message = str(ex)
            call.ended_at = datetime.now(timezone.utc)

            event = CallEventModel(
                id=uuid.uuid4(),
                call_id=call_id,
                event_source="INTERNAL",
                provider=settings.TELEPHONY_PROVIDER,
                provider_event_id=f"fail-{call_id}",
                event_type=CallEventType.CALL_FAILED,
                payload={"error": str(ex)},
                occurred_at=datetime.now(timezone.utc),
                received_at=datetime.now(timezone.utc),
            )
            self.db.add(event)
            await self.db.commit()
            raise

    async def get_call_by_id(self, call_id: uuid.UUID) -> Optional[CallModel]:
        stmt = (
            select(CallModel)
            .options(selectinload(CallModel.legs), selectinload(CallModel.events))
            .where(CallModel.id == call_id)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_recent_calls(self, limit: int = 50) -> List[CallModel]:
        stmt = (
            select(CallModel)
            .options(selectinload(CallModel.legs), selectinload(CallModel.events))
            .order_by(CallModel.created_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def terminate_call(self, call_id: uuid.UUID, reason: Optional[str] = None) -> CallModel:
        """
        Terminates an ongoing or ringing call:
        - Consults CallStateMachine for authoritative target state.
        - Hangs up provider legs.
        - Persists ended_at and duration.
        """
        call = await self.get_call_by_id(call_id)
        if not call:
            raise ValueError(f"Call {call_id} not found")

        now = datetime.now(timezone.utc)
        target_status = CallStateMachine.terminate(call.status)

        # Terminate any active provider legs
        for leg in call.legs:
            if leg.telephony_leg_id and leg.status not in {
                CallLegStatus.COMPLETED,
                CallLegStatus.FAILED,
                CallLegStatus.CANCELLED,
            }:
                try:
                    await self.provider.terminate_leg(leg.telephony_leg_id)
                except Exception:
                    pass
                leg.status = CallLegStatus.COMPLETED if target_status == CallStatus.WRAPUP else CallLegStatus.CANCELLED
                leg.ended_at = now
                if leg.answered_at:
                    leg.duration_seconds = max(0, int((now - ensure_utc(leg.answered_at)).total_seconds()))

        call.status = target_status
        call.ended_at = now
        if call.connected_at:
            call.duration_seconds = max(0, int((now - ensure_utc(call.connected_at)).total_seconds()))

        event = CallEventModel(
            id=uuid.uuid4(),
            call_id=call_id,
            event_source="INTERNAL",
            provider=settings.TELEPHONY_PROVIDER,
            provider_event_id=f"term-{call_id}-{now.timestamp()}",
            event_type=CallEventType.CALL_COMPLETED if target_status == CallStatus.WRAPUP else CallEventType.CALL_CANCELLED,
            payload={"reason": reason or "User requested termination"},
            occurred_at=now,
            received_at=now,
        )
        self.db.add(event)
        await self.db.commit()
        return await self.get_call_by_id(call_id)

    async def process_provider_webhook(
        self,
        provider_name: str,
        raw_headers: Dict[str, str],
        raw_body_bytes: bytes,
        raw_body_data: Dict[str, Any],
        request_url: Optional[str] = None,
    ) -> Tuple[bool, Optional[str], Optional[CallModel]]:
        """
        Processes inbound provider webhook:
        1. Verifies authenticity / cryptographic signature.
        2. Parses into canonical TelephonyEvent.
        3. Safely deduplicates by provider_event_id.
        4. Correlates with call and call leg.
        5. Updates states, chronology, and duration.
        """
        # 1. Verify signature
        is_valid = self.provider.verify_webhook_signature(
            raw_headers=raw_headers, raw_body=raw_body_bytes, request_url=request_url
        )
        if not is_valid:
            return False, "Invalid webhook signature", None

        # 2. Parse into canonical event
        telephony_event = self.provider.parse_webhook_event(raw_headers, raw_body_data)
        telephony_leg_id = telephony_event.telephony_leg_id

        if not telephony_leg_id:
            return True, "No telephony_leg_id found in webhook", None

        # 3. Find leg by provider leg id
        stmt = select(CallLegModel).where(CallLegModel.telephony_leg_id == telephony_leg_id)
        res = await self.db.execute(stmt)
        leg = res.scalar_one_or_none()

        if not leg:
            return True, f"Unrecognized leg {telephony_leg_id}", None

        call = await self.get_call_by_id(leg.call_id)
        if not call:
            return True, f"Associated call {leg.call_id} not found", None

        # 4. Deduplicate: check if event already recorded
        for evt in call.events:
            if evt.provider_event_id == telephony_event.provider_event_id:
                # Idempotent return without duplicate processing
                return True, "Duplicate event ignored", call

        now = datetime.now(timezone.utc)

        # 5. Record event
        call_event = CallEventModel(
            id=uuid.uuid4(),
            call_id=call.id,
            event_source="PROVIDER",
            provider=provider_name,
            provider_event_id=telephony_event.provider_event_id,
            event_type=telephony_event.event_type,
            payload=raw_body_data,
            occurred_at=telephony_event.occurred_at,
            received_at=now,
        )
        self.db.add(call_event)

        # 6. Update leg and call state machine based on event type
        if telephony_event.event_type == CallEventType.LEG_RINGING:
            leg.status = CallLegStatus.RINGING
            if CallStateMachine.can_transition(call.status, CallStatus.CUSTOMER_RINGING):
                call.status = CallStatus.CUSTOMER_RINGING

        elif telephony_event.event_type == CallEventType.CALL_CONNECTED:
            leg.status = CallLegStatus.ANSWERED
            if not leg.answered_at:
                leg.answered_at = now
            if not call.connected_at:
                call.connected_at = now
            if CallStateMachine.can_transition(call.status, CallStatus.CONNECTED):
                call.status = CallStatus.CONNECTED

        elif telephony_event.event_type == CallEventType.CALL_COMPLETED:
            leg.status = CallLegStatus.COMPLETED
            if not leg.ended_at:
                leg.ended_at = now
            if leg.answered_at:
                leg.duration_seconds = max(0, int((now - ensure_utc(leg.answered_at)).total_seconds()))

            if not call.ended_at:
                call.ended_at = now
            if call.connected_at:
                call.duration_seconds = max(0, int((now - ensure_utc(call.connected_at)).total_seconds()))
                call.status = CallStatus.WRAPUP
            else:
                call.status = CallStatus.COMPLETED

        elif telephony_event.event_type in {CallEventType.CALL_BUSY, CallEventType.LEG_BUSY}:
            leg.status = CallLegStatus.BUSY
            leg.ended_at = now
            call.ended_at = now
            call.status = CallStatus.BUSY

        elif telephony_event.event_type in {CallEventType.CALL_NO_ANSWER, CallEventType.LEG_NO_ANSWER}:
            leg.status = CallLegStatus.NO_ANSWER
            leg.ended_at = now
            call.ended_at = now
            call.status = CallStatus.NO_ANSWER

        elif telephony_event.event_type in {CallEventType.CALL_FAILED, CallEventType.CALL_CANCELLED}:
            leg.status = CallLegStatus.FAILED if telephony_event.event_type == CallEventType.CALL_FAILED else CallLegStatus.CANCELLED
            leg.ended_at = now
            call.ended_at = now
            call.status = CallStatus.FAILED if telephony_event.event_type == CallEventType.CALL_FAILED else CallStatus.CANCELLED

        await self.db.commit()
        return True, "Webhook processed successfully", await self.get_call_by_id(call.id)
