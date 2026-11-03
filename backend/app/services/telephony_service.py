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
from backend.app.domains.telephony.twilio_provider import TwilioTelephonyProvider
from backend.app.domains.telephony.plivo_provider import PlivoTelephonyProvider
from backend.app.domains.telephony.exotel_provider import ExotelTelephonyProvider
from backend.app.domains.telephony.mock_provider import MockTelephonyProvider
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

        # Caller ID Selection: strictly enforce provider-configured caller ID for real providers
        prov_name = settings.TELEPHONY_PROVIDER.lower().strip()
        is_simulated = prov_name == "mock" or isinstance(self.provider, MockTelephonyProvider)

        if prov_name == "twilio" and not is_simulated:
            agent_from = settings.TWILIO_AGENT_CALLER_ID or settings.TWILIO_CALLER_ID
            customer_from = settings.TWILIO_CUSTOMER_CALLER_ID or settings.TWILIO_CALLER_ID
            if not agent_from and not customer_from:
                raise ValueError(
                    "Twilio Caller ID is not configured. Please set TWILIO_CALLER_ID "
                    "(or TWILIO_AGENT_CALLER_ID and TWILIO_CUSTOMER_CALLER_ID) in .env"
                )
            if not agent_from:
                raise ValueError("Twilio Agent Caller ID is not configured. Please set TWILIO_AGENT_CALLER_ID or TWILIO_CALLER_ID in .env")
            if not customer_from:
                raise ValueError("Twilio Customer Caller ID is not configured. Please set TWILIO_CUSTOMER_CALLER_ID or TWILIO_CALLER_ID in .env")
        elif prov_name == "plivo" and not is_simulated:
            if not settings.PLIVO_CALLER_ID:
                raise ValueError("Plivo Caller ID is not configured. Please set PLIVO_CALLER_ID in .env")
            agent_from = settings.PLIVO_CALLER_ID
            customer_from = settings.PLIVO_CALLER_ID
        elif prov_name == "exotel" and not is_simulated:
            caller_id = settings.EXOTEL_CALLER_ID or settings.TWILIO_CALLER_ID
            if not caller_id:
                raise ValueError("Exotel Caller ID (ExoPhone) is not configured. Please set EXOTEL_CALLER_ID in .env")
            agent_from = caller_id
            customer_from = caller_id
        else:
            # Mock or offline test provider fallback
            fallback = settings.DEV_AGENT_PHONE or "+919000000001"
            agent_from = settings.TWILIO_AGENT_CALLER_ID or settings.TWILIO_CALLER_ID or settings.EXOTEL_CALLER_ID or fallback
            customer_from = settings.TWILIO_CUSTOMER_CALLER_ID or settings.TWILIO_CALLER_ID or settings.EXOTEL_CALLER_ID or fallback

        # Webhook URL Validation for production environments
        if prov_name in ("twilio", "plivo", "exotel") and not is_simulated and settings.ENVIRONMENT == "production":
            webhook_url = settings.PUBLIC_WEBHOOK_URL.lower().strip()
            if not webhook_url.startswith("https://") or "localhost" in webhook_url or "127.0.0.1" in webhook_url:
                raise ValueError(
                    f"Production call initiation failed: Provider '{prov_name}' requires a publicly reachable "
                    f"HTTPS PUBLIC_WEBHOOK_URL. Configured: '{settings.PUBLIC_WEBHOOK_URL}'"
                )

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
            from_endpoint_uri=customer_from,
            status=CallLegStatus.INITIATING,
            initiated_at=now,
        )

        # 3. Create agent leg to establish complete agent/customer telecaller topology
        if settings.ENVIRONMENT == "production":
            if not agent_endpoint_uri:
                raise ValueError("Agent endpoint URI or phone number is required in production environment.")
            agent_endpoint = agent_endpoint_uri
        else:
            agent_endpoint = agent_endpoint_uri or settings.DEV_AGENT_PHONE
            if prov_name in ("twilio", "plivo", "exotel") and not is_simulated:
                if not agent_endpoint or agent_endpoint.strip() in ("+919000000001", "+910000000000"):
                    raise ValueError(
                        "DEV_AGENT_PHONE is not configured with your actual mobile number. "
                        "Please set DEV_AGENT_PHONE=+91YOUR_NUMBER in .env or provide your agent phone number in the dialpad."
                    )
            agent_endpoint = agent_endpoint or "+919000000001"
        if agent_endpoint.startswith("+"):
            validate_e164(agent_endpoint, "agent_endpoint_uri")
            agent_ep_type = "PSTN"
            agent_to_endpoint_type = EndpointType.PSTN
        else:
            agent_ep_type = "WEBRTC"
            agent_to_endpoint_type = EndpointType.WEBRTC

        agent_leg = CallLegModel(
            id=uuid.uuid4(),
            call_id=call_id,
            leg_role=CallLegRole.AGENT,
            attempt_number=1,
            provider=settings.TELEPHONY_PROVIDER,
            to_endpoint_type=agent_ep_type,
            to_endpoint_uri=agent_endpoint,
            from_endpoint_type="PSTN",
            from_endpoint_uri=agent_from,
            status=CallLegStatus.INITIATING,
            initiated_at=now,
        )

        self.db.add(call)
        self.db.add(customer_leg)
        self.db.add(agent_leg)
        await self.db.flush()

        callback_url = f"{settings.PUBLIC_WEBHOOK_URL.rstrip('/')}/api/v1/telephony/webhooks/{settings.TELEPHONY_PROVIDER}"

        # 4. Exotel Orchestration Check: Exotel v1 Calls/connect initiates one orchestrated call connecting both parties
        is_exotel = prov_name == "exotel" or isinstance(self.provider, ExotelTelephonyProvider)
        if is_exotel and not is_simulated:
            try:
                if hasattr(self.provider, "connect"):
                    call_sid = await self.provider.connect(
                        call_id=str(call_id),
                        from_number=agent_endpoint,
                        to_number=customer_phone,
                        caller_id=customer_from,
                        callback_url=callback_url,
                        time_limit=300,
                    )
                else:
                    req = LegDialRequest(
                        call_id=str(call_id),
                        leg_role=CallLegRole.CUSTOMER,
                        attempt_number=1,
                        to_endpoint_type=EndpointType.PSTN,
                        to_endpoint_uri=customer_phone,
                        from_endpoint_type=EndpointType.PSTN,
                        from_endpoint_uri=customer_from,
                        callback_url=callback_url,
                    )
                    res = await self.provider.initiate_leg(req)
                    call_sid = res.telephony_leg_id

                agent_leg.telephony_leg_id = call_sid
                agent_leg.provider = "exotel"
                agent_leg.status = CallLegStatus.RINGING

                customer_leg.telephony_leg_id = call_sid
                customer_leg.provider = "exotel"
                customer_leg.status = CallLegStatus.RINGING

                call.status = CallStateMachine.transition(call.status, CallStatus.AGENT_RINGING)

                event = CallEventModel(
                    id=uuid.uuid4(),
                    call_id=call_id,
                    event_source="PROVIDER",
                    provider="exotel",
                    provider_event_id=f"{call_sid}-connect-initiated",
                    event_type=CallEventType.CALL_CREATED,
                    payload={"telephony_call_sid": call_sid, "agent": agent_endpoint, "customer": customer_phone},
                    occurred_at=now,
                    received_at=now,
                )
                self.db.add(event)
                await self.db.commit()
                return await self.get_call_by_id(call_id)

            except Exception as ex:
                call.status = CallStatus.FAILED
                agent_leg.status = CallLegStatus.FAILED
                agent_leg.error_message = str(ex)
                customer_leg.status = CallLegStatus.FAILED
                customer_leg.error_message = str(ex)
                call.ended_at = datetime.now(timezone.utc)

                event = CallEventModel(
                    id=uuid.uuid4(),
                    call_id=call_id,
                    event_source="INTERNAL",
                    provider="exotel",
                    provider_event_id=f"fail-exotel-{call_id}",
                    event_type=CallEventType.CALL_FAILED,
                    payload={"error": f"Exotel call initiation failed: {str(ex)}"},
                    occurred_at=datetime.now(timezone.utc),
                    received_at=datetime.now(timezone.utc),
                )
                self.db.add(event)
                await self.db.commit()
                raise

        # 5. Standard two-leg dispatch (Twilio, Plivo, Mock): Step 1: Dispatch Agent Leg via provider
        agent_dial_req = LegDialRequest(
            call_id=str(call_id),
            leg_role=CallLegRole.AGENT,
            attempt_number=1,
            to_endpoint_type=agent_to_endpoint_type,
            to_endpoint_uri=agent_endpoint,
            from_endpoint_type=EndpointType.PSTN,
            from_endpoint_uri=agent_from,
            callback_url=callback_url,
        )

        try:
            agent_dial_res = await self.provider.initiate_leg(agent_dial_req)
            agent_leg.telephony_leg_id = agent_dial_res.telephony_leg_id
            agent_leg.provider = agent_dial_res.provider
            agent_leg.status = CallLegStatus.RINGING
        except Exception as ex:
            call.status = CallStatus.FAILED
            agent_leg.status = CallLegStatus.FAILED
            agent_leg.error_message = str(ex)
            customer_leg.status = CallLegStatus.FAILED
            customer_leg.error_message = "Agent leg initiation failed"
            call.ended_at = datetime.now(timezone.utc)

            event = CallEventModel(
                id=uuid.uuid4(),
                call_id=call_id,
                event_source="INTERNAL",
                provider=settings.TELEPHONY_PROVIDER,
                provider_event_id=f"fail-agent-{call_id}",
                event_type=CallEventType.CALL_FAILED,
                payload={"error": f"Agent leg dispatch failed: {str(ex)}"},
                occurred_at=datetime.now(timezone.utc),
                received_at=datetime.now(timezone.utc),
            )
            self.db.add(event)
            await self.db.commit()
            raise

        # 5. Step 2: Dispatch Customer Leg via provider
        customer_dial_req = LegDialRequest(
            call_id=str(call_id),
            leg_role=CallLegRole.CUSTOMER,
            attempt_number=1,
            to_endpoint_type=EndpointType.PSTN,
            to_endpoint_uri=customer_phone,
            from_endpoint_type=EndpointType.PSTN,
            from_endpoint_uri=customer_from,
            callback_url=callback_url,
        )

        try:
            cust_dial_res = await self.provider.initiate_leg(customer_dial_req)
            customer_leg.telephony_leg_id = cust_dial_res.telephony_leg_id
            customer_leg.provider = cust_dial_res.provider
            customer_leg.status = CallLegStatus.RINGING
        except Exception as ex:
            # Partial initiation failure: Clean up the already-dispatched agent leg!
            if agent_leg.telephony_leg_id:
                try:
                    await self.provider.terminate_leg(agent_leg.telephony_leg_id)
                except Exception:
                    pass

            call.status = CallStatus.FAILED
            agent_leg.status = CallLegStatus.CANCELLED
            agent_leg.ended_at = datetime.now(timezone.utc)
            customer_leg.status = CallLegStatus.FAILED
            customer_leg.error_message = str(ex)
            call.ended_at = datetime.now(timezone.utc)

            event = CallEventModel(
                id=uuid.uuid4(),
                call_id=call_id,
                event_source="INTERNAL",
                provider=settings.TELEPHONY_PROVIDER,
                provider_event_id=f"fail-customer-{call_id}",
                event_type=CallEventType.CALL_FAILED,
                payload={"error": f"Customer leg dispatch failed: {str(ex)}", "agent_leg_rolled_back": True},
                occurred_at=datetime.now(timezone.utc),
                received_at=datetime.now(timezone.utc),
            )
            self.db.add(event)
            await self.db.commit()
            raise

        # 6. Both legs dispatched successfully: Call enters AGENT_RINGING state
        call.status = CallStateMachine.transition(call.status, CallStatus.AGENT_RINGING)

        event_agent = CallEventModel(
            id=uuid.uuid4(),
            call_id=call_id,
            event_source="PROVIDER",
            provider=agent_dial_res.provider,
            provider_event_id=f"{agent_dial_res.telephony_leg_id}-initiated",
            event_type=CallEventType.LEG_INITIATING,
            payload={"telephony_leg_id": agent_dial_res.telephony_leg_id, "to": agent_endpoint, "role": "AGENT"},
            occurred_at=now,
            received_at=now,
        )
        event_customer = CallEventModel(
            id=uuid.uuid4(),
            call_id=call_id,
            event_source="PROVIDER",
            provider=cust_dial_res.provider,
            provider_event_id=f"{cust_dial_res.telephony_leg_id}-initiated",
            event_type=CallEventType.LEG_INITIATING,
            payload={"telephony_leg_id": cust_dial_res.telephony_leg_id, "to": customer_phone, "role": "CUSTOMER"},
            occurred_at=now,
            received_at=now,
        )
        self.db.add(event_agent)
        self.db.add(event_customer)
        await self.db.commit()
        return await self.get_call_by_id(call_id)

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
        # Select provider adapter matching incoming webhook route
        prov_key = provider_name.lower().strip()
        adapter: TelephonyProvider = self.provider
        if prov_key == "twilio" and not isinstance(adapter, TwilioTelephonyProvider):
            adapter = TwilioTelephonyProvider()
        elif prov_key == "plivo" and not isinstance(adapter, PlivoTelephonyProvider):
            adapter = PlivoTelephonyProvider()
        elif prov_key == "exotel" and not isinstance(adapter, ExotelTelephonyProvider):
            adapter = ExotelTelephonyProvider()
        elif prov_key == "mock" and not isinstance(adapter, MockTelephonyProvider):
            adapter = MockTelephonyProvider()

        # 1. Verify signature using the matching provider adapter
        is_valid = adapter.verify_webhook_signature(
            raw_headers=raw_headers, raw_body=raw_body_bytes, request_url=request_url
        )
        if not is_valid:
            return False, "Invalid webhook signature", None

        # 2. Parse into canonical event
        telephony_event = adapter.parse_webhook_event(raw_headers, raw_body_data)
        telephony_leg_id = telephony_event.telephony_leg_id

        if not telephony_leg_id:
            return True, "No telephony_leg_id found in webhook", None

        # 3. Find call and leg by CustomField, telephony_leg_id, or RequestUUID
        call = None
        leg = None

        # Priority A: Correlate by CustomField (OnGround call UUID)
        custom_field = raw_body_data.get("CustomField") or raw_body_data.get("custom_field") or telephony_event.call_id
        if custom_field:
            try:
                call_uuid = uuid.UUID(str(custom_field).strip())
                call = await self.get_call_by_id(call_uuid)
            except Exception:
                call = None

        # Priority B: Correlate by provider telephony_leg_id
        if not call and telephony_leg_id:
            stmt = select(CallLegModel).where(CallLegModel.telephony_leg_id == telephony_leg_id)
            res = await self.db.execute(stmt)
            matching_legs = list(res.scalars().all())
            if matching_legs:
                leg = matching_legs[0]
                call = await self.get_call_by_id(leg.call_id)

        # Priority C: Plivo RequestUUID fallback
        if not call:
            request_uuid = raw_body_data.get("RequestUUID") or raw_body_data.get("request_uuid")
            if request_uuid:
                stmt_req = select(CallLegModel).where(CallLegModel.telephony_leg_id == str(request_uuid))
                res_req = await self.db.execute(stmt_req)
                leg = res_req.scalar_one_or_none()
                if leg:
                    leg.telephony_leg_id = telephony_leg_id
                    call = await self.get_call_by_id(leg.call_id)

        if not call:
            return True, f"Unrecognized leg {telephony_leg_id}", None

        # Resolve representative leg for call
        if not leg:
            leg = next((l for l in call.legs if l.telephony_leg_id == telephony_leg_id), None)
            if not leg and call.legs:
                leg = next((l for l in call.legs if l.leg_role == CallLegRole.CUSTOMER), call.legs[0])

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
        # For Exotel orchestrated calls: single webhook updates the overall call and both legs
        if prov_key == "exotel" or isinstance(adapter, ExotelTelephonyProvider):
            if telephony_event.event_type == CallEventType.LEG_RINGING:
                for l in call.legs:
                    l.status = CallLegStatus.RINGING
                    if not l.initiated_at:
                        l.initiated_at = now
            elif telephony_event.event_type == CallEventType.CALL_CONNECTED:
                for l in call.legs:
                    l.status = CallLegStatus.ANSWERED
                    if not l.answered_at:
                        l.answered_at = now
                if not call.connected_at:
                    call.connected_at = now
                if call.status == CallStatus.AGENT_RINGING:
                    call.status = CallStateMachine.transition(call.status, CallStatus.CUSTOMER_RINGING)
                if CallStateMachine.can_transition(call.status, CallStatus.CONNECTED):
                    call.status = CallStateMachine.transition(call.status, CallStatus.CONNECTED)
            elif telephony_event.event_type == CallEventType.CALL_COMPLETED:
                for l in call.legs:
                    l.status = CallLegStatus.COMPLETED
                    if not l.ended_at:
                        l.ended_at = now
                    if l.answered_at:
                        l.duration_seconds = max(0, int((now - ensure_utc(l.answered_at)).total_seconds()))
                if not call.ended_at:
                    call.ended_at = now
                if call.connected_at:
                    call.duration_seconds = max(0, int((now - ensure_utc(call.connected_at)).total_seconds()))
                    if CallStateMachine.can_transition(call.status, CallStatus.WRAPUP):
                        call.status = CallStateMachine.transition(call.status, CallStatus.WRAPUP)
                else:
                    if CallStateMachine.can_transition(call.status, CallStatus.COMPLETED):
                        call.status = CallStateMachine.transition(call.status, CallStatus.COMPLETED)
                    elif CallStateMachine.can_transition(call.status, CallStatus.CANCELLED):
                        call.status = CallStateMachine.transition(call.status, CallStatus.CANCELLED)
            elif telephony_event.event_type in {CallEventType.CALL_BUSY, CallEventType.LEG_BUSY}:
                for l in call.legs:
                    l.status = CallLegStatus.BUSY
                    l.ended_at = now
                call.ended_at = now
                if CallStateMachine.can_transition(call.status, CallStatus.BUSY):
                    call.status = CallStateMachine.transition(call.status, CallStatus.BUSY)
            elif telephony_event.event_type in {CallEventType.CALL_NO_ANSWER, CallEventType.LEG_NO_ANSWER}:
                for l in call.legs:
                    l.status = CallLegStatus.NO_ANSWER
                    l.ended_at = now
                call.ended_at = now
                if CallStateMachine.can_transition(call.status, CallStatus.NO_ANSWER):
                    call.status = CallStateMachine.transition(call.status, CallStatus.NO_ANSWER)
            elif telephony_event.event_type in {CallEventType.CALL_FAILED, CallEventType.CALL_CANCELLED}:
                target_status = CallStatus.FAILED if telephony_event.event_type == CallEventType.CALL_FAILED else CallStatus.CANCELLED
                for l in call.legs:
                    l.status = CallLegStatus.FAILED if telephony_event.event_type == CallEventType.CALL_FAILED else CallLegStatus.CANCELLED
                    l.ended_at = now
                call.ended_at = now
                if CallStateMachine.can_transition(call.status, target_status):
                    call.status = CallStateMachine.transition(call.status, target_status)

            await self.db.commit()
            return True, "Webhook processed successfully", await self.get_call_by_id(call.id)

        # For multi-leg providers (Twilio, Plivo, Mock): individual leg state management
        agent_leg = next((l for l in call.legs if l.leg_role == CallLegRole.AGENT), None)
        customer_leg = next((l for l in call.legs if l.leg_role == CallLegRole.CUSTOMER), None)

        if telephony_event.event_type == CallEventType.LEG_RINGING:
            leg.status = CallLegStatus.RINGING
            if not leg.initiated_at:
                leg.initiated_at = now
            if agent_leg and agent_leg.status == CallLegStatus.ANSWERED and leg.leg_role == CallLegRole.CUSTOMER:
                if CallStateMachine.can_transition(call.status, CallStatus.CUSTOMER_RINGING):
                    call.status = CallStateMachine.transition(call.status, CallStatus.CUSTOMER_RINGING)

        elif telephony_event.event_type == CallEventType.CALL_CONNECTED:
            leg.status = CallLegStatus.ANSWERED
            if not leg.answered_at:
                leg.answered_at = now

            # Check if BOTH legs have answered before transitioning call to CONNECTED
            other_leg = customer_leg if leg.leg_role == CallLegRole.AGENT else agent_leg
            both_answered = (
                leg.status == CallLegStatus.ANSWERED
                and other_leg is not None
                and other_leg.status == CallLegStatus.ANSWERED
            )

            if both_answered:
                # Bridge media between agent leg and customer leg into conference room
                bridge_failed = False
                bridge_error = ""
                if agent_leg and customer_leg and agent_leg.telephony_leg_id and customer_leg.telephony_leg_id:
                    try:
                        await adapter.bridge_legs(
                            call_id=str(call.id),
                            agent_leg_id=agent_leg.telephony_leg_id,
                            customer_leg_id=customer_leg.telephony_leg_id,
                        )
                    except Exception as bridge_ex:
                        bridge_failed = True
                        bridge_error = str(bridge_ex)

                if bridge_failed:
                    # Bridge failed! Terminate both legs and mark call as FAILED (do NOT mark CONNECTED)
                    call.status = CallStatus.FAILED
                    call.ended_at = now
                    for l in (agent_leg, customer_leg):
                        if l and l.telephony_leg_id:
                            try:
                                await adapter.terminate_leg(l.telephony_leg_id)
                            except Exception:
                                pass
                            l.status = CallLegStatus.FAILED
                            l.ended_at = now
                            l.error_message = f"Conference bridge failed: {bridge_error}"

                    err_event = CallEventModel(
                        id=uuid.uuid4(),
                        call_id=call.id,
                        event_source="INTERNAL",
                        provider=provider_name,
                        provider_event_id=f"bridge-failed-{call.id}",
                        event_type=CallEventType.CALL_FAILED,
                        payload={"error": f"Conference bridge failed: {bridge_error}"},
                        occurred_at=now,
                        received_at=now,
                    )
                    self.db.add(err_event)
                else:
                    if not call.connected_at:
                        call.connected_at = now

                    # Transition call through CUSTOMER_RINGING if currently in AGENT_RINGING
                    if call.status == CallStatus.AGENT_RINGING:
                        call.status = CallStateMachine.transition(call.status, CallStatus.CUSTOMER_RINGING)
                    if CallStateMachine.can_transition(call.status, CallStatus.CONNECTED):
                        call.status = CallStateMachine.transition(call.status, CallStatus.CONNECTED)
            else:
                # Only one leg answered
                if leg.leg_role == CallLegRole.AGENT:
                    # Agent answered first; customer is still ringing
                    if CallStateMachine.can_transition(call.status, CallStatus.CUSTOMER_RINGING):
                        call.status = CallStateMachine.transition(call.status, CallStatus.CUSTOMER_RINGING)
                else:
                    # Customer answered first; agent is still ringing
                    # Call remains in AGENT_RINGING until agent picks up
                    pass

        elif telephony_event.event_type == CallEventType.CALL_COMPLETED:
            leg.status = CallLegStatus.COMPLETED
            if not leg.ended_at:
                leg.ended_at = now
            if leg.answered_at:
                leg.duration_seconds = max(0, int((now - ensure_utc(leg.answered_at)).total_seconds()))

            # Disconnect the other leg if still active
            other_leg = customer_leg if leg.leg_role == CallLegRole.AGENT else agent_leg
            if other_leg and other_leg.telephony_leg_id and other_leg.status not in {
                CallLegStatus.COMPLETED,
                CallLegStatus.FAILED,
                CallLegStatus.CANCELLED,
                CallLegStatus.BUSY,
                CallLegStatus.NO_ANSWER,
            }:
                try:
                    await adapter.terminate_leg(other_leg.telephony_leg_id)
                except Exception:
                    pass
                other_leg.status = CallLegStatus.COMPLETED if call.connected_at else CallLegStatus.CANCELLED
                other_leg.ended_at = now

            if not call.ended_at:
                call.ended_at = now
            if call.connected_at:
                call.duration_seconds = max(0, int((now - ensure_utc(call.connected_at)).total_seconds()))
                if CallStateMachine.can_transition(call.status, CallStatus.WRAPUP):
                    call.status = CallStateMachine.transition(call.status, CallStatus.WRAPUP)
            else:
                if CallStateMachine.can_transition(call.status, CallStatus.CANCELLED):
                    call.status = CallStateMachine.transition(call.status, CallStatus.CANCELLED)
                elif CallStateMachine.can_transition(call.status, CallStatus.COMPLETED):
                    call.status = CallStateMachine.transition(call.status, CallStatus.COMPLETED)

        elif telephony_event.event_type in {CallEventType.CALL_BUSY, CallEventType.LEG_BUSY}:
            leg.status = CallLegStatus.BUSY
            leg.ended_at = now
            other_leg = customer_leg if leg.leg_role == CallLegRole.AGENT else agent_leg
            if other_leg and other_leg.telephony_leg_id and other_leg.status not in {
                CallLegStatus.COMPLETED,
                CallLegStatus.FAILED,
                CallLegStatus.CANCELLED,
                CallLegStatus.BUSY,
                CallLegStatus.NO_ANSWER,
            }:
                try:
                    await adapter.terminate_leg(other_leg.telephony_leg_id)
                except Exception:
                    pass
                other_leg.status = CallLegStatus.CANCELLED
                other_leg.ended_at = now

            call.ended_at = now
            if CallStateMachine.can_transition(call.status, CallStatus.BUSY):
                call.status = CallStateMachine.transition(call.status, CallStatus.BUSY)

        elif telephony_event.event_type in {CallEventType.CALL_NO_ANSWER, CallEventType.LEG_NO_ANSWER}:
            leg.status = CallLegStatus.NO_ANSWER
            leg.ended_at = now
            other_leg = customer_leg if leg.leg_role == CallLegRole.AGENT else agent_leg
            if other_leg and other_leg.telephony_leg_id and other_leg.status not in {
                CallLegStatus.COMPLETED,
                CallLegStatus.FAILED,
                CallLegStatus.CANCELLED,
                CallLegStatus.BUSY,
                CallLegStatus.NO_ANSWER,
            }:
                try:
                    await adapter.terminate_leg(other_leg.telephony_leg_id)
                except Exception:
                    pass
                other_leg.status = CallLegStatus.CANCELLED
                other_leg.ended_at = now

            call.ended_at = now
            if CallStateMachine.can_transition(call.status, CallStatus.NO_ANSWER):
                call.status = CallStateMachine.transition(call.status, CallStatus.NO_ANSWER)

        elif telephony_event.event_type in {CallEventType.CALL_FAILED, CallEventType.CALL_CANCELLED}:
            target_status = CallStatus.FAILED if telephony_event.event_type == CallEventType.CALL_FAILED else CallStatus.CANCELLED
            leg.status = CallLegStatus.FAILED if telephony_event.event_type == CallEventType.CALL_FAILED else CallLegStatus.CANCELLED
            leg.ended_at = now
            other_leg = customer_leg if leg.leg_role == CallLegRole.AGENT else agent_leg
            if other_leg and other_leg.telephony_leg_id and other_leg.status not in {
                CallLegStatus.COMPLETED,
                CallLegStatus.FAILED,
                CallLegStatus.CANCELLED,
                CallLegStatus.BUSY,
                CallLegStatus.NO_ANSWER,
            }:
                try:
                    await adapter.terminate_leg(other_leg.telephony_leg_id)
                except Exception:
                    pass
                other_leg.status = CallLegStatus.CANCELLED
                other_leg.ended_at = now

            call.ended_at = now
            if CallStateMachine.can_transition(call.status, target_status):
                call.status = CallStateMachine.transition(call.status, target_status)

        await self.db.commit()
        return True, "Webhook processed successfully", await self.get_call_by_id(call.id)

    async def bridge_call_legs(self, call_id: uuid.UUID) -> CallModel:
        """
        Manually or programmatically triggers provider media bridging between active call legs.
        Raises:
            LookupError: If call does not exist.
            ValueError: If legs are missing, not yet initiated, or in a terminal status.
            RuntimeError: If provider API fails to establish conference bridge.
        """
        call = await self.get_call_by_id(call_id)
        if not call:
            raise LookupError(f"Call {call_id} not found")

        agent_leg = next((l for l in call.legs if l.leg_role == CallLegRole.AGENT), None)
        customer_leg = next((l for l in call.legs if l.leg_role == CallLegRole.CUSTOMER), None)
        if not agent_leg or not customer_leg:
            raise ValueError("Both agent and customer legs must exist to bridge call")

        if not agent_leg.telephony_leg_id or not customer_leg.telephony_leg_id:
            raise ValueError("Both agent and customer legs must have active provider telephony leg IDs to bridge")

        terminal_statuses = {
            CallLegStatus.COMPLETED,
            CallLegStatus.FAILED,
            CallLegStatus.CANCELLED,
            CallLegStatus.BUSY,
            CallLegStatus.NO_ANSWER,
        }
        if agent_leg.status in terminal_statuses or customer_leg.status in terminal_statuses:
            raise ValueError("Cannot bridge legs that are already terminated")

        # For real carrier calls, both handsets must have answered before bridging (except Exotel which bridges automatically)
        if not call.is_simulated and isinstance(self.provider, (TwilioTelephonyProvider, PlivoTelephonyProvider)):
            if agent_leg.status != CallLegStatus.ANSWERED or customer_leg.status != CallLegStatus.ANSWERED:
                raise ValueError(
                    f"Cannot bridge legs until both have answered. Current: Agent={agent_leg.status.value}, Customer={customer_leg.status.value}"
                )

        now = datetime.now(timezone.utc)
        if not isinstance(self.provider, ExotelTelephonyProvider):
            await self.provider.bridge_legs(
                call_id=str(call.id),
                agent_leg_id=agent_leg.telephony_leg_id,
                customer_leg_id=customer_leg.telephony_leg_id,
            )

        if customer_leg.status != CallLegStatus.ANSWERED:
            customer_leg.status = CallLegStatus.ANSWERED
            if not customer_leg.answered_at:
                customer_leg.answered_at = now

        if agent_leg.status != CallLegStatus.ANSWERED:
            agent_leg.status = CallLegStatus.ANSWERED
            if not agent_leg.answered_at:
                agent_leg.answered_at = now

        if call.status == CallStatus.AGENT_RINGING:
            call.status = CallStateMachine.transition(call.status, CallStatus.CUSTOMER_RINGING)
        if CallStateMachine.can_transition(call.status, CallStatus.CONNECTED):
            call.status = CallStateMachine.transition(call.status, CallStatus.CONNECTED)
        if not call.connected_at:
            call.connected_at = now

        event = CallEventModel(
            id=uuid.uuid4(),
            call_id=call_id,
            event_source="INTERNAL",
            provider=settings.TELEPHONY_PROVIDER,
            provider_event_id=f"bridge-{call_id}-{now.timestamp()}",
            event_type=CallEventType.CALL_CONNECTED,
            payload={"action": "bridge_legs", "status": "bridged"},
            occurred_at=now,
            received_at=now,
        )
        self.db.add(event)
        await self.db.commit()
        return await self.get_call_by_id(call_id)
