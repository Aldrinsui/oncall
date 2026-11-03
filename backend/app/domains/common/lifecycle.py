from backend.app.domains.common.enums import CallStatus

def determine_terminated_call_status(current_status: CallStatus) -> CallStatus:
    """
    Calculates target status when a call termination request is received:
    - If CONNECTED or ON_HOLD: transitions to WRAPUP (agent completes documentation).
    - If pre-connection (QUEUED, INITIATING, AGENT_RINGING, CUSTOMER_RINGING): transitions to CANCELLED.
    - If already terminal (COMPLETED, FAILED, BUSY, NO_ANSWER, CANCELLED): returns current_status idempotently.
    - If already in WRAPUP: remains in WRAPUP.
    """
    if current_status in {CallStatus.CONNECTED, CallStatus.ON_HOLD}:
        return CallStatus.WRAPUP
    if current_status in {
        CallStatus.QUEUED,
        CallStatus.INITIATING,
        CallStatus.AGENT_RINGING,
        CallStatus.CUSTOMER_RINGING,
    }:
        return CallStatus.CANCELLED
    if current_status in {
        CallStatus.COMPLETED,
        CallStatus.FAILED,
        CallStatus.BUSY,
        CallStatus.NO_ANSWER,
        CallStatus.CANCELLED,
        CallStatus.WRAPUP,
    }:
        return current_status
    return CallStatus.CANCELLED
