import pytest
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from uuid import uuid4
from pydantic import ValidationError

from backend.app.schemas.crm import UpdateLeadRequest, LeadDTO, CustomerDTO
from backend.app.schemas.telephony import CallDTO, CallLegDTO, InitiateCallRequest
from backend.app.schemas.identity import UpdateEndpointRequest, AgentDTO
from backend.app.schemas.compliance import ConsentRequest
from backend.app.schemas.calendar import (
    CalendarEventDTO,
    CreateCalendarEventRequest,
    CalendarParticipantDTO,
    InviteCollaboratorItem,
)
from backend.app.schemas.intelligence import AvaniQueryData
from backend.app.schemas.tasks import CreateTaskRequest, UpdateTaskRequest
from backend.app.schemas.pulse import PostMessageRequest, PinnedItemResponseRequest
from backend.app.schemas.engagement import CreateKudosRequest
from backend.app.schemas.training import StartRoleplayRequest, RoleplayTurnRequest
from backend.app.domains.common.enums import (
    CallStatus,
    CallDirection,
    CallLegRole,
    CallLegStatus,
    EndpointType,
    AgentEndpointType,
    ConsentDecision,
    ConsentMethod,
    ParticipantStatus,
)

def test_update_lead_request_notes_and_extra_fields():
    """Verify UpdateLeadRequest accepts notes and forbids unknown fields."""
    # Valid with notes
    req = UpdateLeadRequest(notes="Special discount requested", status_label="In Progress")
    assert req.notes == "Special discount requested"
    assert req.status_label == "In Progress"

    # Reject unexpected fields
    with pytest.raises(ValidationError):
        UpdateLeadRequest(unknown_field="not_allowed")

def test_lead_dto_notes_and_decimal():
    """Verify LeadDTO includes notes and uses Decimal for monetary value."""
    lead = LeadDTO(
        id=uuid4(),
        customer_id=uuid4(),
        customer_name="Mukunda R.",
        customer_phone="+919845012345",
        interest="Ortho GRID",
        product="Ortho GRID Mattress",
        expected_value=Decimal("8490.00"),
        badge="Hot",
        badge_color="#10b981",
        status_label="Open",
        source="Walk-in",
        notes="Follow up on 12-month EMI",
    )
    assert lead.notes == "Follow up on 12-month EMI"
    assert isinstance(lead.expected_value, Decimal)
    assert lead.expected_value == Decimal("8490.00")

def test_strict_e164_on_dto_phone_fields():
    """Verify CustomerDTO and LeadDTO reject non-E.164 phone formats (P1.1)."""
    with pytest.raises(ValidationError):
        CustomerDTO(id=uuid4(), name="Priya", phone_e164="+abc", brand="TSC")

    with pytest.raises(ValidationError):
        LeadDTO(
            id=uuid4(),
            customer_id=uuid4(),
            customer_name="Priya",
            customer_phone="+invalid",
            interest="Mattress",
            product="Luxe",
            badge="Hot",
            badge_color="#fff",
            status_label="New",
            source="Walk-in",
        )

def test_call_dto_does_not_expose_is_simulated():
    """Verify CallDTO does NOT contain or expose the internal is_simulated column."""
    call_fields = CallDTO.model_fields.keys()
    assert "is_simulated" not in call_fields
    assert "request_fingerprint" not in call_fields
    assert "duration_seconds" in call_fields
    assert "legs" in call_fields

def test_call_leg_endpoint_types_enforced_as_enums():
    """Verify CallLegDTO requires valid EndpointType enum values."""
    leg = CallLegDTO(
        id=uuid4(),
        leg_role=CallLegRole.AGENT,
        attempt_number=1,
        provider="mock",
        to_endpoint_type=EndpointType.WEBRTC,
        to_endpoint_uri="webrtc:agent-dev",
        from_endpoint_type=EndpointType.WEBRTC,
        from_endpoint_uri="webrtc:server",
        status=CallLegStatus.COMPLETED,
        initiated_at=datetime.now(timezone.utc),
    )
    assert leg.to_endpoint_type == EndpointType.WEBRTC

    # Invalid endpoint type string raises ValidationError
    with pytest.raises(ValidationError):
        CallLegDTO(
            id=uuid4(),
            leg_role=CallLegRole.AGENT,
            attempt_number=1,
            provider="mock",
            to_endpoint_type="INVALID_TYPE",  # Not in EndpointType enum
            to_endpoint_uri="webrtc:agent-dev",
            from_endpoint_type=EndpointType.WEBRTC,
            from_endpoint_uri="webrtc:server",
            status=CallLegStatus.COMPLETED,
            initiated_at=datetime.now(timezone.utc),
        )

def test_update_endpoint_request_agent_endpoint_type_and_pstn_validation():
    """Verify UpdateEndpointRequest validates AgentEndpointType and requires phone agreement for PSTN."""
    # Valid WebRTC
    req_webrtc = UpdateEndpointRequest(
        endpoint_type=AgentEndpointType.WEBRTC_MOCK,
        endpoint_uri="webrtc:agent-dev",
    )
    assert req_webrtc.endpoint_type == AgentEndpointType.WEBRTC_MOCK

    # Valid PSTN with matching phone
    req_pstn = UpdateEndpointRequest(
        endpoint_type=AgentEndpointType.PSTN_PHONE,
        endpoint_uri="+919000000001",
        phone_e164="+919000000001",
    )
    assert req_pstn.phone_e164 == "+919000000001"

    # PSTN missing phone_e164 raises ValidationError
    with pytest.raises(ValidationError):
        UpdateEndpointRequest(
            endpoint_type=AgentEndpointType.PSTN_PHONE,
            endpoint_uri="+919000000001",
            phone_e164=None,
        )

    # PSTN phone mismatch raises ValidationError
    with pytest.raises(ValidationError):
        UpdateEndpointRequest(
            endpoint_type=AgentEndpointType.PSTN_PHONE,
            endpoint_uri="+919000000001",
            phone_e164="+919876543210",
        )

def test_consent_request_only_accepts_granted_or_declined():
    """Verify ConsentRequest rejects PENDING and only accepts GRANTED or DECLINED."""
    req_granted = ConsentRequest(status=ConsentDecision.GRANTED, method=ConsentMethod.VOICE)
    assert req_granted.status == ConsentDecision.GRANTED

    req_declined = ConsentRequest(status=ConsentDecision.DECLINED, method=ConsentMethod.VOICE)
    assert req_declined.status == ConsentDecision.DECLINED

    # PENDING is rejected
    with pytest.raises(ValidationError):
        ConsentRequest(status="PENDING", method=ConsentMethod.VOICE)

def test_calendar_event_chronology_and_participant_consistency():
    """Verify CalendarEvent enforces ends_at >= starts_at and is_agent consistency."""
    now = datetime.now(timezone.utc)

    # Valid event
    evt = CreateCalendarEventRequest(
        title="1:1 Coaching",
        starts_at=now,
        ends_at=now + timedelta(minutes=30),
    )
    assert evt.ends_at > evt.starts_at

    # ends_at < starts_at raises ValidationError
    with pytest.raises(ValidationError):
        CreateCalendarEventRequest(
            title="Invalid",
            starts_at=now,
            ends_at=now - timedelta(minutes=10),
        )

    # Participant: is_agent=True requires agent_id
    with pytest.raises(ValidationError):
        CalendarParticipantDTO(
            id=uuid4(),
            is_agent=True,
            agent_id=None,
            name="Agent",
            role="Tele-caller",
            email_or_channel="agent@store.com",
        )

    # Participant: is_agent=False rejects agent_id (P1.3)
    with pytest.raises(ValidationError):
        CalendarParticipantDTO(
            id=uuid4(),
            is_agent=False,
            agent_id=uuid4(),
            name="External Client",
            role="Buyer",
            email_or_channel="client@external.com",
        )

    with pytest.raises(ValidationError):
        InviteCollaboratorItem(
            name="External Client",
            role="Buyer",
            email_or_channel="client@external.com",
            is_agent=False,
            agent_id=uuid4(),
        )

def test_avani_query_confidence_constrained():
    """Verify AvaniQueryData confidence must be between 0.0 and 1.0."""
    valid = AvaniQueryData(intent="progress", response_text="Pace on track", confidence=0.92)
    assert valid.confidence == 0.92

    # Confidence > 1.0 raises ValidationError
    with pytest.raises(ValidationError):
        AvaniQueryData(intent="progress", response_text="Error", confidence=1.5)

    # Confidence < 0.0 raises ValidationError
    with pytest.raises(ValidationError):
        AvaniQueryData(intent="progress", response_text="Error", confidence=-0.1)

def test_extra_fields_forbidden_across_all_request_models():
    """Verify standard extra='forbid' across all API request models (P1.4)."""
    # Task requests
    with pytest.raises(ValidationError):
        CreateTaskRequest(title="Task", extra_key="blocked")
    with pytest.raises(ValidationError):
        UpdateTaskRequest(title="Task", extra_key="blocked")

    # Pulse requests
    with pytest.raises(ValidationError):
        PostMessageRequest(body="Hello", extra_key="blocked")
    with pytest.raises(ValidationError):
        PinnedItemResponseRequest(selected_option="Yes", extra_key="blocked")

    # Kudos request
    with pytest.raises(ValidationError):
        CreateKudosRequest(agent_id=uuid4(), reason="Good work", extra_key="blocked")

    # Training requests
    with pytest.raises(ValidationError):
        StartRoleplayRequest(persona_id="suresh", extra_key="blocked")
    with pytest.raises(ValidationError):
        RoleplayTurnRequest(agent_speech="Hello", extra_key="blocked")
