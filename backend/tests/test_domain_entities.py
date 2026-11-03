import pytest
from datetime import datetime, timezone, timedelta, date
from decimal import Decimal
from uuid import uuid4

import backend.app.domains as domains
from backend.app.domains.common.enums import (
    UserRole,
    CallStatus,
    CallDirection,
    CallLegRole,
    CallLegStatus,
    CallEventType,
    TaskStatus,
    ConsentState,
    ConsentMethod,
    ParticipantStatus,
    NotificationAction,
    EndpointType,
    AgentEndpointType,
)

def test_all_22_pure_domain_entities_instantiable():
    """Verify that all 22 pure domain entities can be instantiated without ORM."""
    uid = uuid4()
    now = datetime.now(timezone.utc)

    # 1. User
    user = domains.User(id=uid, email="agent@store.com", full_name="Test Agent", role=UserRole.AGENT)
    assert user.email == "agent@store.com"

    # 2. Agent (requires explicit user_id)
    agent = domains.Agent(
        id=uid, user_id=uid, initials="TA", store="Koramangala", brand="The Sleep Company",
        endpoint_type=AgentEndpointType.WEBRTC_MOCK, endpoint_uri="webrtc:agent-dev", og_score=85
    )
    assert agent.user_id == uid
    assert agent.og_score == 85

    # 3. Customer
    customer = domains.Customer(id=uid, name="Priya", phone_e164="+919876543210", brand="The Sleep Company")
    assert customer.phone_e164 == "+919876543210"

    # 4. Lead (requires explicit customer_id)
    lead = domains.Lead(
        id=uid, customer_id=uid, interest="SmartGRID Luxe", product="Luxe Mattress",
        expected_value=Decimal("15999.00"), attractiveness_score=90, notes="Customer requested WhatsApp quote"
    )
    assert lead.customer_id == uid
    assert lead.notes == "Customer requested WhatsApp quote"
    assert lead.expected_value == Decimal("15999.00")

    # 5. BuyingSignal (requires explicit lead_id)
    signal = domains.BuyingSignal(id=uid, lead_id=uid, label="Financing", detail="Asked about EMI")
    assert signal.lead_id == uid
    assert signal.label == "Financing"

    # 6. Call (requires explicit agent_id and customer_id)
    call = domains.Call(
        id=uid, agent_id=uid, customer_id=uid, direction=CallDirection.OUTBOUND,
        status=CallStatus.CONNECTED, idempotency_key="key-1", request_fingerprint="fp-1",
        created_at=now - timedelta(minutes=5), initiated_at=now - timedelta(minutes=4),
        connected_at=now - timedelta(minutes=3), ended_at=now
    )
    assert call.agent_id == uid
    assert call.customer_id == uid
    assert call.duration_seconds == 180

    # 7. CallLeg (requires explicit call_id)
    leg = domains.CallLeg(
        id=uid, call_id=uid, leg_role=CallLegRole.CUSTOMER, attempt_number=1,
        to_endpoint_type=EndpointType.PSTN, to_endpoint_uri="+919876543210",
        from_endpoint_type=EndpointType.PSTN, from_endpoint_uri="+919000000001",
        status=CallLegStatus.COMPLETED, initiated_at=now - timedelta(minutes=4),
        answered_at=now - timedelta(minutes=3), ended_at=now
    )
    assert leg.call_id == uid
    assert leg.duration_seconds == 180

    # 8. CallEvent (requires explicit call_id)
    evt = domains.CallEvent(
        id=uid, call_id=uid, provider="mock", provider_event_id="evt-1", event_source="MOCK",
        event_type=CallEventType.CALL_CONNECTED, occurred_at=now, received_at=now
    )
    assert evt.call_id == uid
    assert evt.event_type == CallEventType.CALL_CONNECTED

    # 9. ConsentRecord (requires explicit customer_id and agent_id)
    consent = domains.ConsentRecord(
        id=uid, call_id=uid, customer_id=uid, agent_id=uid, status=ConsentState.GRANTED,
        method=ConsentMethod.VOICE, requested_at=now - timedelta(minutes=1), consented_at=now
    )
    assert consent.customer_id == uid
    assert consent.agent_id == uid
    assert consent.status == ConsentState.GRANTED

    # 10. CallSopReview (requires explicit call_id)
    sop = domains.CallSopReview(id=uid, call_id=uid, criterion="Greeting", passed=True, score=95, evidence="Greeted in 5s")
    assert sop.call_id == uid
    assert sop.score == 95

    # 11. RoleplaySession (requires explicit agent_id)
    roleplay = domains.RoleplaySession(id=uid, agent_id=uid, persona_id="suresh", score=88, turns_count=4)
    assert roleplay.agent_id == uid
    assert roleplay.score == 88

    # 12. Task (requires explicit agent_id)
    task = domains.Task(id=uid, agent_id=uid, title="Follow up with Mukunda", status=TaskStatus.PENDING, due_date=date.today())
    assert task.agent_id == uid
    assert task.title == "Follow up with Mukunda"

    # 13. CalendarEvent (requires explicit organizer_id)
    cal_event = domains.CalendarEvent(
        id=uid, organizer_id=uid, title="SOP Review", session_slug="sop-review-1",
        starts_at=now, ends_at=now + timedelta(hours=1)
    )
    assert cal_event.organizer_id == uid
    assert cal_event.session_slug == "sop-review-1"

    # 14. CalendarParticipant (requires explicit event_id)
    cal_part = domains.CalendarParticipant(
        id=uid, event_id=uid, is_agent=True, agent_id=uid, name="Sunita Rao",
        role="Manager", email_or_channel="sunita@store.com", status=ParticipantStatus.INVITED
    )
    assert cal_part.event_id == uid
    assert cal_part.name == "Sunita Rao"

    # 15. Channel
    channel = domains.Channel(id=uid, store="Koramangala", name="callcentre-team")
    assert channel.store == "Koramangala"

    # 16. Message (requires explicit channel_id and sender_id)
    msg = domains.Message(id=uid, channel_id=uid, sender_id=uid, body="Team meeting starting now")
    assert msg.channel_id == uid
    assert msg.sender_id == uid
    assert msg.body == "Team meeting starting now"

    # 17. MessageRead (requires explicit channel_id, message_id, agent_id)
    read = domains.MessageRead(channel_id=uid, message_id=uid, agent_id=uid, read_at=now)
    assert read.read_at == now

    # 18. PulsePinnedItem (requires explicit channel_id)
    pin = domains.PulsePinnedItem(id=uid, channel_id=uid, question="Confirm shift?")
    assert pin.channel_id == uid
    assert pin.question == "Confirm shift?"

    # 19. PulsePinnedResponse (requires explicit pinned_item_id and agent_id)
    pin_resp = domains.PulsePinnedResponse(id=uid, pinned_item_id=uid, agent_id=uid, selected_option="Confirmed")
    assert pin_resp.pinned_item_id == uid
    assert pin_resp.agent_id == uid
    assert pin_resp.selected_option == "Confirmed"

    # 20. Kudos (requires explicit agent_id and given_by)
    other_uid = uuid4()
    kudos = domains.Kudos(id=uid, agent_id=uid, given_by=other_uid, reason="Great pitch!")
    assert kudos.agent_id == uid
    assert kudos.given_by == other_uid
    assert kudos.reason == "Great pitch!"

    # 21. KudosLike (requires explicit kudos_id and agent_id)
    like = domains.KudosLike(kudos_id=uid, agent_id=uid, liked_at=now)
    assert like.kudos_id == uid
    assert like.agent_id == uid

    # 22. Notification (requires explicit agent_id)
    notif = domains.Notification(id=uid, agent_id=uid, title="New Lead", message="New walk-in lead assigned")
    assert notif.agent_id == uid
    assert notif.title == "New Lead"

def test_foreign_keys_cannot_be_omitted():
    """Verify that omitting required relationship identifiers raises TypeError (P0.2)."""
    uid = uuid4()
    # Agent requires user_id
    with pytest.raises(TypeError, match="user_id"):
        domains.Agent(initials="TA")  # type: ignore

    # Call requires agent_id and customer_id
    with pytest.raises(TypeError):
        domains.Call(agent_id=uid)  # type: ignore

    # Lead requires customer_id
    with pytest.raises(TypeError, match="customer_id"):
        domains.Lead(interest="Mattress")  # type: ignore

    # Task requires agent_id
    with pytest.raises(TypeError, match="agent_id"):
        domains.Task(title="Follow up")  # type: ignore

    # Message requires channel_id and sender_id
    with pytest.raises(TypeError):
        domains.Message(body="Hello")  # type: ignore

    # Notification requires agent_id
    with pytest.raises(TypeError, match="agent_id"):
        domains.Notification(title="Alert", message="msg")  # type: ignore

def test_strict_e164_validation_on_entities():
    """Verify shared E.164 validator rejects invalid numbers such as '+abc' (P1.1)."""
    uid = uuid4()
    # Customer phone
    with pytest.raises(ValueError, match="valid E.164"):
        domains.Customer(name="Priya", phone_e164="+abc")

    with pytest.raises(ValueError, match="valid E.164"):
        domains.Customer(name="Priya", phone_e164="9876543210")

    # Agent phone
    with pytest.raises(ValueError, match="valid E.164"):
        domains.Agent(user_id=uid, phone_e164="+abc")

    # CallLeg PSTN endpoints
    with pytest.raises(ValueError, match="valid E.164"):
        domains.CallLeg(
            call_id=uid,
            to_endpoint_type=EndpointType.PSTN,
            to_endpoint_uri="+invalid",
            from_endpoint_type=EndpointType.PSTN,
            from_endpoint_uri="+919000000000",
        )

def test_agent_pstn_endpoint_uri_consistency():
    """Verify PSTN agent verifies endpoint_uri agrees with phone_e164 (P1.3)."""
    uid = uuid4()
    # Mismatch between endpoint_uri and phone_e164
    with pytest.raises(ValueError, match="must match phone_e164"):
        domains.Agent(
            user_id=uid,
            endpoint_type=AgentEndpointType.PSTN_PHONE,
            phone_e164="+919876543210",
            endpoint_uri="+919000000000",
        )

    # Valid agreement (raw E.164 or tel: prefix)
    agent_valid1 = domains.Agent(
        user_id=uid,
        endpoint_type=AgentEndpointType.PSTN_PHONE,
        phone_e164="+919876543210",
        endpoint_uri="+919876543210",
    )
    assert agent_valid1.endpoint_uri == "+919876543210"

    agent_valid2 = domains.Agent(
        user_id=uid,
        endpoint_type=AgentEndpointType.PSTN_PHONE,
        phone_e164="+919876543210",
        endpoint_uri="tel:+919876543210",
    )
    assert agent_valid2.endpoint_uri == "tel:+919876543210"

def test_call_leg_and_event_non_empty_constraints():
    """Verify CallLeg rejects empty URIs and CallEvent rejects empty provider IDs (P1.3)."""
    uid = uuid4()
    with pytest.raises(ValueError, match="to_endpoint_uri cannot be empty"):
        domains.CallLeg(call_id=uid, to_endpoint_uri="")

    with pytest.raises(ValueError, match="from_endpoint_uri cannot be empty"):
        domains.CallLeg(call_id=uid, to_endpoint_uri="sip:agent@domain.com", from_endpoint_uri="  ")

    with pytest.raises(ValueError, match="provider_event_id cannot be empty"):
        domains.CallEvent(call_id=uid, provider_event_id="")

def test_calendar_event_timezone_awareness():
    """Verify CalendarEvent explicitly rejects timezone-naive timestamps (P1.3)."""
    uid = uuid4()
    naive_dt = datetime(2026, 11, 3, 10, 0, 0)  # tzinfo=None
    aware_dt = datetime.now(timezone.utc)

    with pytest.raises(ValueError, match="must be timezone-aware"):
        domains.CalendarEvent(
            organizer_id=uid, title="Meeting", session_slug="slug-1",
            starts_at=naive_dt, ends_at=aware_dt
        )

    with pytest.raises(ValueError, match="must be timezone-aware"):
        domains.CalendarEvent(
            organizer_id=uid, title="Meeting", session_slug="slug-1",
            starts_at=aware_dt, ends_at=naive_dt
        )

def test_calendar_participant_cross_field_consistency():
    """Verify CalendarParticipant cross-field consistency for is_agent and agent_id (P1.3)."""
    uid = uuid4()
    # is_agent=True requires agent_id
    with pytest.raises(ValueError, match="agent_id is required when is_agent is True"):
        domains.CalendarParticipant(
            event_id=uid, is_agent=True, agent_id=None, name="Priya", email_or_channel="priya@test.com"
        )

    # is_agent=False rejects agent_id
    with pytest.raises(ValueError, match="agent_id must be None when is_agent is False"):
        domains.CalendarParticipant(
            event_id=uid, is_agent=False, agent_id=uid, name="Priya", email_or_channel="priya@test.com"
        )

def test_domain_entity_validation_rules():
    """Verify remaining business rules enforced at domain entity level."""
    uid = uuid4()
    # Invalid user email
    with pytest.raises(ValueError):
        domains.User(email="invalid_email_format", full_name="Agent")

    # Invalid agent score
    with pytest.raises(ValueError):
        domains.Agent(user_id=uid, og_score=150)

    # PSTN phone requires E.164
    with pytest.raises(ValueError):
        domains.Agent(user_id=uid, endpoint_type=AgentEndpointType.PSTN_PHONE, phone_e164="not-a-phone")

    # Lead negative expected value
    with pytest.raises(ValueError):
        domains.Lead(customer_id=uid, expected_value=Decimal("-10.00"))

    # Consent GRANTED requires consented_at
    with pytest.raises(ValueError):
        domains.ConsentRecord(customer_id=uid, agent_id=uid, status=ConsentState.GRANTED, consented_at=None)

    # Calendar ends_at cannot precede starts_at
    now = datetime.now(timezone.utc)
    with pytest.raises(ValueError):
        domains.CalendarEvent(organizer_id=uid, title="Sync", session_slug="sync-1", starts_at=now, ends_at=now - timedelta(hours=1))

    # Channel store cannot be empty
    with pytest.raises(ValueError):
        domains.Channel(store="", name="general")

    # Agent cannot give kudos to self
    agent_id = uuid4()
    with pytest.raises(ValueError):
        domains.Kudos(agent_id=agent_id, given_by=agent_id, reason="Self kudos")
