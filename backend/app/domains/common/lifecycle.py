from backend.app.domains.common.enums import CallStatus
from backend.app.domains.telephony.state_machine import CallStateMachine

def determine_terminated_call_status(current_status: CallStatus) -> CallStatus:
    """
    Authoritatively delegates conditional call termination logic to CallStateMachine.

    - If CONNECTED or ON_HOLD: transitions to WRAPUP (agent completes wrapup form).
    - If pre-connection (QUEUED, INITIATING, AGENT_RINGING, CUSTOMER_RINGING): transitions to CANCELLED.
    - If already terminal: idempotent no-op returning current terminal state.
    - If already in WRAPUP: returns WRAPUP.
    """
    return CallStateMachine.terminate(current_status)
