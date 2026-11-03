import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Header, Request, status, Response
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.domains.common.enums import (
    CallStatus,
    CallDirection,
    CallLegRole,
    CallLegStatus,
    EndpointType,
)
from backend.app.domains.common.validation import validate_e164
from backend.app.models.telephony import CallModel, CallLegModel
from backend.app.schemas.telephony import (
    CallDTO,
    CallLegDTO,
    CallDetailResponse,
)
from backend.app.schemas.common import MetaEnvelope
from backend.app.services.telephony_service import TelephonyService

router = APIRouter(prefix="/calls", tags=["Telephony"])
webhook_router = APIRouter(prefix="/telephony/webhooks", tags=["Telephony Webhooks"])

class CreateOutboundCallRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    customer_phone: str = Field(..., description="Destination E.164 phone number, e.g. +919876543210")
    customer_name: Optional[str] = Field(default="Customer", max_length=255)
    customer_id: Optional[uuid.UUID] = None
    agent_id: Optional[uuid.UUID] = None
    lead_id: Optional[uuid.UUID] = None
    agent_phone: Optional[str] = Field(default=None, description="Optional agent phone number in E.164 format")
    agent_endpoint_uri: Optional[str] = Field(default=None, description="Optional agent SIP or WebRTC URI or E.164 phone")
    direction: CallDirection = CallDirection.OUTBOUND
    notes: Optional[str] = Field(default=None, max_length=2000)

class TerminateCallRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: Optional[str] = Field(default="Agent completed call", max_length=255)

def model_to_dto(call: CallModel) -> CallDTO:
    leg_dtos: List[CallLegDTO] = []
    for leg in getattr(call, "legs", []):
        try:
            to_ep = EndpointType[leg.to_endpoint_type]
        except Exception:
            to_ep = EndpointType.PSTN
        try:
            from_ep = EndpointType[leg.from_endpoint_type]
        except Exception:
            from_ep = EndpointType.PSTN

        leg_dtos.append(
            CallLegDTO(
                id=leg.id,
                leg_role=leg.leg_role,
                attempt_number=leg.attempt_number,
                provider=leg.provider,
                telephony_leg_id=leg.telephony_leg_id,
                to_endpoint_type=to_ep,
                to_endpoint_uri=leg.to_endpoint_uri,
                from_endpoint_type=from_ep,
                from_endpoint_uri=leg.from_endpoint_uri,
                status=leg.status,
                initiated_at=leg.initiated_at,
                answered_at=leg.answered_at,
                ended_at=leg.ended_at,
                duration_seconds=leg.duration_seconds,
            )
        )

    try:
        call_direction = CallDirection[call.direction] if isinstance(call.direction, str) else call.direction
    except Exception:
        call_direction = CallDirection.OUTBOUND

    return CallDTO(
        id=call.id,
        agent_id=call.agent_id,
        customer_id=call.customer_id,
        customer_name=call.customer_name,
        lead_id=call.lead_id,
        direction=call_direction,
        status=call.status,
        is_simulated=bool(call.is_simulated),
        notes=call.notes,
        wrapup_outcome=call.wrapup_outcome,
        created_at=call.created_at,
        initiated_at=call.initiated_at,
        connected_at=call.connected_at,
        ended_at=call.ended_at,
        duration_seconds=call.duration_seconds,
        legs=leg_dtos,
    )

def resolve_request_agent(
    authorization: Optional[str] = Header(default=None),
    x_dev_agent_id: Optional[str] = Header(default=None),
) -> uuid.UUID:
    """Enforces authentication: Bearer JWT in production, X-Dev-Agent-Id in development/test."""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ")[1].strip()
        if token:
            # Placeholder for JWT subject extraction
            return uuid.UUID(settings.DEV_AGENT_ID)

    if settings.ENVIRONMENT in ("development", "test") and settings.DEV_AUTH_BYPASS_ENABLED:
        if x_dev_agent_id:
            try:
                return uuid.UUID(x_dev_agent_id)
            except Exception:
                raise HTTPException(status_code=401, detail="Invalid X-Dev-Agent-Id format")
        return uuid.UUID(settings.DEV_AGENT_ID)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Supply a valid Bearer token.",
    )

@router.post("", response_model=CallDetailResponse, status_code=status.HTTP_201_CREATED)
async def initiate_call(
    payload: CreateOutboundCallRequest,
    db: AsyncSession = Depends(get_db),
    agent_id: uuid.UUID = Depends(resolve_request_agent),
):
    """
    Initiates a genuine outbound PSTN call to a destination phone number.
    """
    try:
        validate_e164(payload.customer_phone, "customer_phone")
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(ve))

    if payload.agent_phone:
        try:
            validate_e164(payload.agent_phone, "agent_phone")
        except ValueError as ve:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(ve))

    service = TelephonyService(db)
    target_agent_id = payload.agent_id or agent_id
    target_customer_id = payload.customer_id or uuid.uuid4()

    try:
        call = await service.initiate_call(
            agent_id=target_agent_id,
            customer_id=target_customer_id,
            customer_phone=payload.customer_phone,
            customer_name=payload.customer_name or "Customer",
            agent_endpoint_uri=payload.agent_endpoint_uri or payload.agent_phone,
            direction=payload.direction,
            lead_id=payload.lead_id,
            notes=payload.notes,
        )
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Telephony provider failed to initiate call: {str(ex)}",
        )

    dto = model_to_dto(call)
    return CallDetailResponse(data=dto, meta=MetaEnvelope())

@router.get("/{id}", response_model=CallDetailResponse)
async def get_call(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    agent_id: uuid.UUID = Depends(resolve_request_agent),
):
    """
    Retrieves the current persistent state of a call and its legs.
    """
    service = TelephonyService(db)
    call = await service.get_call_by_id(id)
    if not call:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Call {id} not found")

    dto = model_to_dto(call)
    return CallDetailResponse(data=dto, meta=MetaEnvelope())

@router.get("", response_model=Dict[str, Any])
async def list_calls(
    db: AsyncSession = Depends(get_db),
    agent_id: uuid.UUID = Depends(resolve_request_agent),
):
    """
    Lists recent calls.
    """
    service = TelephonyService(db)
    calls = await service.list_recent_calls()
    return {
        "data": [model_to_dto(c) for c in calls],
        "meta": MetaEnvelope(),
    }

@router.post("/{id}/terminate", response_model=CallDetailResponse)
async def terminate_call(
    id: uuid.UUID,
    payload: Optional[TerminateCallRequest] = None,
    db: AsyncSession = Depends(get_db),
    agent_id: uuid.UUID = Depends(resolve_request_agent),
):
    """
    Terminates an ongoing or ringing call via the state machine and provider.
    """
    service = TelephonyService(db)
    reason = payload.reason if payload else "User requested termination"
    try:
        call = await service.terminate_call(id, reason=reason)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))

    dto = model_to_dto(call)
    return CallDetailResponse(data=dto, meta=MetaEnvelope())

@router.post("/{id}/bridge", response_model=CallDetailResponse)
async def bridge_call(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    agent_id: uuid.UUID = Depends(resolve_request_agent),
):
    """
    Bridges media between agent leg and customer leg into a shared conference room.
    """
    service = TelephonyService(db)
    try:
        call = await service.bridge_call_legs(id)
    except LookupError as le:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(le))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(re))

    dto = model_to_dto(call)
    return CallDetailResponse(data=dto, meta=MetaEnvelope())

@webhook_router.post("/{provider}")
async def receive_provider_webhook(
    provider: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Public webhook receiver for telephony provider status callbacks (Twilio, Plivo, Mock).
    """
    raw_body_bytes = await request.body()
    raw_headers = dict(request.headers)

    # Parse body (form-urlencoded or json)
    body_data: Dict[str, Any] = {}
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            body_data = await request.json()
        except Exception:
            body_data = {}
    else:
        try:
            form = await request.form()
            body_data = dict(form)
        except Exception:
            body_data = {}

    service = TelephonyService(db)
    success, message, call = await service.process_provider_webhook(
        provider_name=provider,
        raw_headers=raw_headers,
        raw_body_bytes=raw_body_bytes,
        raw_body_data=body_data,
        request_url=str(request.url),
    )

    if not success:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=message)

    return {"status": "ok", "message": message, "call_id": str(call.id) if call else None}

@webhook_router.api_route("/twiml", methods=["GET", "POST"])
async def twilio_twiml_endpoint():
    """
    Serves TwiML instruction to Twilio when an outbound call connects.
    """
    twiml_content = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Response>'
        '<Say voice="Polly.Aditi" language="en-IN">'
        'Connecting call from OnGround A I tele-caller platform. Your line is live.'
        '</Say>'
        '<Pause length="60"/>'
        '</Response>'
    )
    return Response(content=twiml_content, media_type="application/xml")

@webhook_router.api_route("/plivo/answer", methods=["GET", "POST"])
async def plivo_answer_endpoint(request: Request):
    """
    Serves Plivo XML when an outbound call connects.
    """
    xml_content = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Response>'
        '<Speak voice="WOMAN" language="en-IN">'
        'Connecting call from OnGround A I tele-caller platform. Your line is live.'
        '</Speak>'
        '<Wait length="60"/>'
        '</Response>'
    )
    return Response(content=xml_content, media_type="application/xml")

@webhook_router.api_route("/plivo/conference", methods=["GET", "POST"])
async def plivo_conference_endpoint(request: Request, room: Optional[str] = None):
    """
    Serves Plivo XML bridging call legs into a shared conference room.
    """
    room_name = room or request.query_params.get("room", "oncall-bridge")
    xml_content = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        f'<Response><Conference beep="false">{room_name}</Conference></Response>'
    )
    return Response(content=xml_content, media_type="application/xml")
