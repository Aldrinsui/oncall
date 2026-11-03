import pytest
from backend.app.domains.common.enums import (
    CallStatus,
    CallLegStatus,
)
from backend.app.domains.telephony.state_machine import (
    CallStateMachine,
    IllegalStateTransitionError,
)

def test_valid_forward_call_lifecycle_transitions():
    """Verify standard happy-path progression through FSM."""
    state = CallStatus.QUEUED

    state = CallStateMachine.transition(state, CallStatus.INITIATING)
    assert state == CallStatus.INITIATING

    state = CallStateMachine.transition(state, CallStatus.AGENT_RINGING)
    assert state == CallStatus.AGENT_RINGING

    state = CallStateMachine.transition(state, CallStatus.CUSTOMER_RINGING)
    assert state == CallStatus.CUSTOMER_RINGING

    state = CallStateMachine.transition(state, CallStatus.CONNECTED)
    assert state == CallStatus.CONNECTED

    # Bidirectional hold & resume
    state = CallStateMachine.transition(state, CallStatus.ON_HOLD)
    assert state == CallStatus.ON_HOLD

    state = CallStateMachine.transition(state, CallStatus.CONNECTED)
    assert state == CallStatus.CONNECTED

    state = CallStateMachine.transition(state, CallStatus.WRAPUP)
    assert state == CallStatus.WRAPUP

    state = CallStateMachine.transition(state, CallStatus.COMPLETED)
    assert state == CallStatus.COMPLETED

def test_illegal_call_transitions_raise_error():
    """Verify prohibited transitions raise IllegalStateTransitionError."""
    # Cannot jump from QUEUED to CONNECTED
    with pytest.raises(IllegalStateTransitionError):
        CallStateMachine.transition(CallStatus.QUEUED, CallStatus.CONNECTED)

    # Cannot jump from AGENT_RINGING to WRAPUP
    with pytest.raises(IllegalStateTransitionError):
        CallStateMachine.transition(CallStatus.AGENT_RINGING, CallStatus.WRAPUP)

    # Cannot transition out of terminal state COMPLETED
    with pytest.raises(IllegalStateTransitionError):
        CallStateMachine.transition(CallStatus.COMPLETED, CallStatus.CONNECTED)

    # Cannot transition out of terminal state CANCELLED
    with pytest.raises(IllegalStateTransitionError):
        CallStateMachine.transition(CallStatus.CANCELLED, CallStatus.INITIATING)

def test_idempotent_transitions_return_same_state():
    """Transitioning to the same state is an idempotent no-op."""
    assert CallStateMachine.transition(CallStatus.CONNECTED, CallStatus.CONNECTED) == CallStatus.CONNECTED
    assert CallStateMachine.transition(CallStatus.COMPLETED, CallStatus.COMPLETED) == CallStatus.COMPLETED

def test_conditional_termination_semantics():
    """
    Verify conditional call termination logic:
    - Active connected/on-hold calls -> WRAPUP
    - Pre-connection calls -> CANCELLED
    - Already terminal calls -> idempotent return
    """
    # Active calls transition to WRAPUP
    assert CallStateMachine.terminate(CallStatus.CONNECTED) == CallStatus.WRAPUP
    assert CallStateMachine.terminate(CallStatus.ON_HOLD) == CallStatus.WRAPUP

    # Pre-connection calls transition to CANCELLED
    assert CallStateMachine.terminate(CallStatus.QUEUED) == CallStatus.CANCELLED
    assert CallStateMachine.terminate(CallStatus.INITIATING) == CallStatus.CANCELLED
    assert CallStateMachine.terminate(CallStatus.AGENT_RINGING) == CallStatus.CANCELLED
    assert CallStateMachine.terminate(CallStatus.CUSTOMER_RINGING) == CallStatus.CANCELLED

    # Already terminal calls return idempotently
    assert CallStateMachine.terminate(CallStatus.COMPLETED) == CallStatus.COMPLETED
    assert CallStateMachine.terminate(CallStatus.FAILED) == CallStatus.FAILED
    assert CallStateMachine.terminate(CallStatus.BUSY) == CallStatus.BUSY
    assert CallStateMachine.terminate(CallStatus.NO_ANSWER) == CallStatus.NO_ANSWER
    assert CallStateMachine.terminate(CallStatus.CANCELLED) == CallStatus.CANCELLED

    # Already in WRAPUP stays WRAPUP
    assert CallStateMachine.terminate(CallStatus.WRAPUP) == CallStatus.WRAPUP

def test_leg_to_call_resolution_matrix():
    """Verify parent call state derivation from discrete leg states."""
    # Leg 1 initiating
    assert CallStateMachine.resolve_call_status(CallLegStatus.INITIATING, None) == CallStatus.INITIATING

    # Leg 1 ringing
    assert CallStateMachine.resolve_call_status(CallLegStatus.RINGING, None) == CallStatus.AGENT_RINGING

    # Leg 1 answered, Leg 2 ringing
    assert CallStateMachine.resolve_call_status(CallLegStatus.ANSWERED, CallLegStatus.RINGING) == CallStatus.CUSTOMER_RINGING

    # Both legs answered -> CONNECTED
    assert CallStateMachine.resolve_call_status(CallLegStatus.ANSWERED, CallLegStatus.ANSWERED) == CallStatus.CONNECTED

    # Customer leg busy/no answer
    assert CallStateMachine.resolve_call_status(CallLegStatus.ANSWERED, CallLegStatus.BUSY) == CallStatus.BUSY
    assert CallStateMachine.resolve_call_status(CallLegStatus.ANSWERED, CallLegStatus.NO_ANSWER) == CallStatus.NO_ANSWER

    # Agent leg completed/hung up -> WRAPUP
    assert CallStateMachine.resolve_call_status(CallLegStatus.COMPLETED, CallLegStatus.ANSWERED) == CallStatus.WRAPUP
