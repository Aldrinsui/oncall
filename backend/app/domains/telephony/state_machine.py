from typing import Optional, Set, Dict
from backend.app.domains.common.enums import (
    CallStatus,
    CallLegStatus,
)

class IllegalStateTransitionError(ValueError):
    """Raised when an invalid state transition is attempted on a Call."""
    pass

class CallStateMachine:
    """
    Executable Finite State Machine (FSM) enforcing canonical call state transitions
    as defined in the Master Architecture Specification (Section 6).
    """

    PERMITTED_TRANSITIONS: Dict[CallStatus, Set[CallStatus]] = {
        CallStatus.QUEUED: {CallStatus.INITIATING, CallStatus.CANCELLED},
        CallStatus.INITIATING: {
            CallStatus.AGENT_RINGING,
            CallStatus.CUSTOMER_RINGING,
            CallStatus.FAILED,
            CallStatus.CANCELLED,
        },
        CallStatus.AGENT_RINGING: {
            CallStatus.CUSTOMER_RINGING,
            CallStatus.BUSY,
            CallStatus.NO_ANSWER,
            CallStatus.FAILED,
            CallStatus.CANCELLED,
        },
        CallStatus.CUSTOMER_RINGING: {
            CallStatus.CONNECTED,
            CallStatus.BUSY,
            CallStatus.NO_ANSWER,
            CallStatus.FAILED,
            CallStatus.CANCELLED,
        },
        CallStatus.CONNECTED: {CallStatus.ON_HOLD, CallStatus.WRAPUP, CallStatus.FAILED},
        CallStatus.ON_HOLD: {CallStatus.CONNECTED, CallStatus.WRAPUP, CallStatus.FAILED},
        CallStatus.WRAPUP: {CallStatus.COMPLETED},
        # Terminal states have no further outgoing transitions
        CallStatus.COMPLETED: set(),
        CallStatus.FAILED: set(),
        CallStatus.BUSY: set(),
        CallStatus.NO_ANSWER: set(),
        CallStatus.CANCELLED: set(),
    }

    TERMINAL_STATES: Set[CallStatus] = {
        CallStatus.COMPLETED,
        CallStatus.FAILED,
        CallStatus.BUSY,
        CallStatus.NO_ANSWER,
        CallStatus.CANCELLED,
    }

    @classmethod
    def can_transition(cls, current: CallStatus, target: CallStatus) -> bool:
        if current == target:
            return True
        return target in cls.PERMITTED_TRANSITIONS.get(current, set())

    @classmethod
    def transition(cls, current: CallStatus, target: CallStatus) -> CallStatus:
        """
        Validates and executes state transition.
        Idempotent if current == target.
        Raises IllegalStateTransitionError if transition is prohibited.
        """
        if current == target:
            return current

        permitted = cls.PERMITTED_TRANSITIONS.get(current, set())
        if target not in permitted:
            raise IllegalStateTransitionError(
                f"Prohibited call transition from '{current.value}' to '{target.value}'. "
                f"Permitted targets: {[s.value for s in permitted]}"
            )
        return target

    @classmethod
    def terminate(cls, current: CallStatus) -> CallStatus:
        """
        Conditional call termination logic:
        - If CONNECTED or ON_HOLD: transitions to WRAPUP (agent completes wrapup form).
        - If pre-connection (QUEUED, INITIATING, AGENT_RINGING, CUSTOMER_RINGING): transitions to CANCELLED.
        - If already terminal: idempotent no-op returning current terminal state.
        - If already in WRAPUP: returns WRAPUP.
        """
        if current in {CallStatus.CONNECTED, CallStatus.ON_HOLD}:
            return cls.transition(current, CallStatus.WRAPUP)
        elif current in {
            CallStatus.QUEUED,
            CallStatus.INITIATING,
            CallStatus.AGENT_RINGING,
            CallStatus.CUSTOMER_RINGING,
        }:
            return cls.transition(current, CallStatus.CANCELLED)
        elif current in cls.TERMINAL_STATES or current == CallStatus.WRAPUP:
            return current
        raise IllegalStateTransitionError(f"Cannot terminate call in unknown state: {current}")

    @classmethod
    def resolve_call_status(
        cls, agent_leg_status: CallLegStatus, customer_leg_status: Optional[CallLegStatus]
    ) -> CallStatus:
        """
        Derives the parent Call status from its discrete call legs according to
        the Section 6b Leg-to-Call State Resolution Matrix.
        """
        # If agent leg busy or no answer (not a generic failure)
        if agent_leg_status == CallLegStatus.BUSY:
            return CallStatus.BUSY
        if agent_leg_status == CallLegStatus.NO_ANSWER:
            return CallStatus.NO_ANSWER

        # If agent leg failed/cancelled
        if agent_leg_status == CallLegStatus.FAILED:
            return CallStatus.FAILED
        if agent_leg_status == CallLegStatus.CANCELLED:
            return CallStatus.CANCELLED

        # Leg 1 initiating
        if agent_leg_status == CallLegStatus.INITIATING:
            return CallStatus.INITIATING

        # Leg 1 ringing
        if agent_leg_status == CallLegStatus.RINGING:
            return CallStatus.AGENT_RINGING

        # Leg 1 answered
        if agent_leg_status == CallLegStatus.ANSWERED:
            if not customer_leg_status or customer_leg_status == CallLegStatus.INITIATING:
                return CallStatus.CUSTOMER_RINGING
            if customer_leg_status == CallLegStatus.RINGING:
                return CallStatus.CUSTOMER_RINGING
            if customer_leg_status == CallLegStatus.ANSWERED:
                return CallStatus.CONNECTED
            if customer_leg_status == CallLegStatus.BUSY:
                return CallStatus.BUSY
            if customer_leg_status == CallLegStatus.NO_ANSWER:
                return CallStatus.NO_ANSWER
            if customer_leg_status == CallLegStatus.FAILED:
                return CallStatus.FAILED
            if customer_leg_status == CallLegStatus.CANCELLED:
                return CallStatus.CANCELLED
            if customer_leg_status == CallLegStatus.COMPLETED:
                return CallStatus.WRAPUP

        # Leg 1 completed/hung up
        if agent_leg_status == CallLegStatus.COMPLETED:
            return CallStatus.WRAPUP

        return CallStatus.FAILED
