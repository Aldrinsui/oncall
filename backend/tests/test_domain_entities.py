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

    # 2. Agent
    agent = domains.Agent(
        id=uid, user_id=uid, initials="TA", store="Koramangala", brand="The Sleep Company",
        endpoint_type=AgentEndpointType.WEBRTC_MOCK, og_score=85
    )
    assert agent.og_score == 85

    # 3. Customer
    customer = domains.Customer(id=uid, name="Priya", phone_e164="+919876543210", brand="The Sleep Company")
    assert customer.phone_e164 == "+919876543210"

    # 4. Lead
    lead = domains.Lead(
        id=uid, customer_id=uid, interest="SmartGRID Luxe", product="Luxe Mattress",
        expected_value=Decimal("15999.00"), attractiveness_score=90, notes="Customer requested WhatsApp quote"
    )
    assert lead.notes == "Customer requested WhatsApp quote"
    assert lead.expected_value == Decimal("15999.00")

    # 5. BuyingSignal
    signal = domains.BuyingSignal(id=uid, lead_id=uid, label="Financing", detail="Asked about EMI")
    assert signal.label == "Financing"

    # 6. Call
    call = domains.Call(
        id=uid, agent_id=uid, customer_id=uid, direction=CallDirection.OUTBOUND,
        status=CallStatus.CONNECTED, idempotency_key="key-1", request_fingerprint="fp-1",
        created_at=now - timedelta(minutes=5), initiated_at=now - timedelta(minutes=4),
        connected_at=now - timedelta(minutes=3), ended_at=now
    )
    assert call.duration_seconds == 180

    # 7. CallLeg
    leg = domains.CallLeg(
        id=uid, call_id=uid, leg_role=CallLegRole.CUSTOMER, attempt_number=1,
        to_endpoint_type=EndpointType.PSTN, to_endpoint_uri="+919876543210",
        from_endpoint_type=EndpointType.PSTN, from_endpoint_uri="+919000000001",
        status=CallLegStatus.COMPLETED, initiated_at=now - timedelta(minutes=4),
        answered_at=now - timedelta(minutes=3), ended_at=now
    )
    assert leg.duration_seconds == 180

    # 8. CallEvent
    evt = domains.CallEvent(
        id=uid, call_id=uid, provider="mock", provider_event_id="evt-1",
        event_type=CallEventType.CALL_CONNECTED, occurred_at=now, received_at=now
    )
    assert evt.event_type == CallEventType.CALL_CONNECTED

    # 9. ConsentRecord
    consent = domains.ConsentRecord(
        id=uid, call_id=uid, customer_id=uid, agent_id=uid, status=ConsentState.GRANTED,
        method=ConsentMethod.VOICE, requested_at=now - timedelta(minutes=1), consented_at=now
    )
    assert consent.status == ConsentState.GRANTED

    # 10. CallSopReview
    sop = domains.CallSopReview(id=uid, call_id=uid, criterion="Greeting", passed=True, score=95, evidence="Greeted in 5s")
    assert sop.score == 95

    # 11. RoleplaySession
    roleplay = domains.RoleplaySession(id=uid, agent_id=uid, persona_id="suresh", score=88, turns_count=4)
    assert roleplay.score == 88

    # 12. Task
    task = domains.Task(id=uid, agent_id=uid, title="Follow up with Mukunda", status=TaskStatus.PENDING, due_date=date.today())
    assert task.title == "Follow up with Mukunda"

    # 13. CalendarEvent
    cal_event = domains.CalendarEvent(
        id=uid, organizer_id=uid, title="SOP Review", session_slug="sop-review-1",
        starts_at=now, ends_at=now + timedelta(hours=1)
    )
    assert cal_event.session_slug == "sop-review-1"

    # 14. CalendarParticipant
    cal_part = domains.CalendarParticipant(
        id=uid, event_id=uid, is_agent=True, agent_id=uid, name="Sunita Rao",
        role="Manager", email_or_channel="sunita@store.com", status=ParticipantStatus.INVITED
    )
    assert cal_part.name == "Sunita Rao"

    # 15. Channel
    channel = domains.Channel(id=uid, store="Koramangala", name="callcentre-team")
    assert channel.store == "Koramangala"

    # 16. Message
    msg = domains.Message(id=uid, channel_id=uid, sender_id=uid, body="Team meeting starting now")
    assert msg.body == "Team meeting starting now"

    # 17. MessageRead
    read = domains.MessageRead(agent_id=uid, message_id=uid, read_at=now)
    assert read.read_at == now

    # 18. PulsePinnedItem
    pin = domains.PulsePinnedItem(id=uid, channel_id=uid, question="Confirm shift?")
    assert pin.question == "Confirm shift?"

    # 19. PulsePinnedResponse
    pin_resp = domains.PulsePinnedResponse(id=uid, pinned_item_id=uid, agent_id=uid, selected_option="Confirmed")
    assert pin_resp.selected_option == "Confirmed"

    # 20. Kudos
    kudos = domains.Kudos(id=uid, agent_id=uid, given_by=uuid4(), reason="Great pitch!")
    assert kudos.reason == "Great pitch!"

    # 21. KudosLike
    like = domains.KudosLike(kudos_id=uid, agent_id=uid, liked_at=now)
    assert like.agent_id == uid

    # 22. Notification
    notif = domains.Notification(id=uid, agent_id=uid, title="New Lead", message="New walk-in lead assigned")
    assert notif.title == "New Lead"

def test_domain_entity_validation_rules():
    """Verify business rules enforced at domain entity level."""
    # Invalid user email
    with pytest.raises(ValueError):
        domains.User(email="invalid_email_format", full_name="Agent")

    # Invalid agent score
    with pytest.raises(ValueError):
        domains.Agent(og_score=150)

    # PSTN phone requires E.164
    with pytest.raises(ValueError):
        domains.Agent(endpoint_type=AgentEndpointType.PSTN_PHONE, phone_e164="not-a-phone")

    # Lead negative expected value
    with pytest.raises(ValueError):
        domains.Lead(expected_value=Decimal("-10.00"))

    # Consent GRANTED requires consented_at
    with pytest.raises(ValueError):
        domains.ConsentRecord(status=ConsentState.GRANTED, consented_at=None)

    # Calendar ends_at cannot precede starts_at
    now = datetime.now(timezone.utc)
    with pytest.raises(ValueError):
        domains.CalendarEvent(title="Sync", session_slug="sync-1", starts_at=now, ends_at=now - timedelta(hours=1))

    # Channel store cannot be empty
    with pytest.raises(ValueError):
        domains.Channel(store="", name="general")

    # Agent cannot give kudos to self
    agent_id = uuid4()
    with pytest.raises(ValueError):
        domains.Kudos(agent_id=agent_id, given_by=agent_id, reason="Self kudos")
