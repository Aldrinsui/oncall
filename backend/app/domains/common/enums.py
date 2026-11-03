from enum import Enum

class UserRole(str, Enum):
    AGENT = "AGENT"
    MANAGER = "MANAGER"
    ADMIN = "ADMIN"

class CallDirection(str, Enum):
    OUTBOUND = "OUTBOUND"
    INBOUND = "INBOUND"

class CallStatus(str, Enum):
    QUEUED = "QUEUED"
    INITIATING = "INITIATING"
    AGENT_RINGING = "AGENT_RINGING"
    CUSTOMER_RINGING = "CUSTOMER_RINGING"
    CONNECTED = "CONNECTED"
    ON_HOLD = "ON_HOLD"
    WRAPUP = "WRAPUP"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    BUSY = "BUSY"
    NO_ANSWER = "NO_ANSWER"
    CANCELLED = "CANCELLED"

class CallLegRole(str, Enum):
    AGENT = "AGENT"
    CUSTOMER = "CUSTOMER"

class CallLegStatus(str, Enum):
    INITIATING = "INITIATING"
    RINGING = "RINGING"
    ANSWERED = "ANSWERED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    BUSY = "BUSY"
    NO_ANSWER = "NO_ANSWER"
    CANCELLED = "CANCELLED"

class CallEventType(str, Enum):
    CALL_CREATED = "CALL_CREATED"
    LEG_INITIATING = "LEG_INITIATING"
    LEG_RINGING = "LEG_RINGING"
    LEG_ANSWERED = "LEG_ANSWERED"
    CALL_CONNECTED = "CALL_CONNECTED"
    CALL_ON_HOLD = "CALL_ON_HOLD"
    CALL_RESUMED = "CALL_RESUMED"
    LEG_TERMINATED = "LEG_TERMINATED"
    CALL_WRAPUP_STARTED = "CALL_WRAPUP_STARTED"
    CALL_COMPLETED = "CALL_COMPLETED"
    CALL_FAILED = "CALL_FAILED"
    CALL_BUSY = "CALL_BUSY"
    CALL_NO_ANSWER = "CALL_NO_ANSWER"
    CALL_CANCELLED = "CALL_CANCELLED"

class TaskStatus(str, Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    BLOCKED = "BLOCKED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class ConsentState(str, Enum):
    PENDING = "PENDING"
    GRANTED = "GRANTED"
    DECLINED = "DECLINED"

class ConsentDecision(str, Enum):
    GRANTED = "GRANTED"
    DECLINED = "DECLINED"

class ConsentMethod(str, Enum):
    VOICE = "VOICE"
    WHATSAPP = "WHATSAPP"
    SMS = "SMS"

class ParticipantStatus(str, Enum):
    INVITED = "INVITED"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"
    TENTATIVE = "TENTATIVE"

class NotificationAction(str, Enum):
    OPEN_PULSE_CHANNEL = "OPEN_PULSE_CHANNEL"
    OPEN_INCOMING_CALLS = "OPEN_INCOMING_CALLS"
    OPEN_COACH = "OPEN_COACH"
    VIEW_SCORE = "VIEW_SCORE"
    VIEW_RANK = "VIEW_RANK"

class EndpointType(str, Enum):
    WEBRTC = "WEBRTC"
    SIP = "SIP"
    PSTN = "PSTN"

class AgentEndpointType(str, Enum):
    WEBRTC_MOCK = "WEBRTC_MOCK"
    SIP_URI = "SIP_URI"
    PSTN_PHONE = "PSTN_PHONE"

AGENT_ENDPOINT_TO_LEG_TYPE: dict[str, EndpointType] = {
    AgentEndpointType.WEBRTC_MOCK.value: EndpointType.WEBRTC,
    AgentEndpointType.SIP_URI.value: EndpointType.SIP,
    AgentEndpointType.PSTN_PHONE.value: EndpointType.PSTN,
}
