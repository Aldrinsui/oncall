from backend.app.domains.identity.entities import User, Agent
from backend.app.domains.crm.entities import Customer, Lead, BuyingSignal
from backend.app.domains.telephony.entities import Call, CallLeg, CallEvent
from backend.app.domains.telephony.state_machine import CallStateMachine, IllegalStateTransitionError
from backend.app.domains.compliance.entities import ConsentRecord, CallSopReview
from backend.app.domains.training.entities import RoleplaySession
from backend.app.domains.productivity.entities import Task
from backend.app.domains.scheduling.entities import CalendarEvent, CalendarParticipant
from backend.app.domains.collaboration.entities import (
    Channel,
    Message,
    MessageRead,
    PulsePinnedItem,
    PulsePinnedResponse,
)
from backend.app.domains.engagement.entities import Kudos, KudosLike
from backend.app.domains.system.entities import Notification

__all__ = [
    # 22 Domain Entities
    "User",
    "Agent",
    "Customer",
    "Lead",
    "BuyingSignal",
    "Call",
    "CallLeg",
    "CallEvent",
    "ConsentRecord",
    "CallSopReview",
    "RoleplaySession",
    "Task",
    "CalendarEvent",
    "CalendarParticipant",
    "Channel",
    "Message",
    "MessageRead",
    "PulsePinnedItem",
    "PulsePinnedResponse",
    "Kudos",
    "KudosLike",
    "Notification",
    # State Machine
    "CallStateMachine",
    "IllegalStateTransitionError",
]
