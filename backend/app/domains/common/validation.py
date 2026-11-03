import re
from datetime import datetime

E164_REGEX = re.compile(r"^\+[1-9]\d{1,14}$")

def is_valid_e164(phone: str) -> bool:
    """Returns True if the string strictly complies with E.164 international phone number standard."""
    if not phone or not isinstance(phone, str):
        return False
    return bool(E164_REGEX.match(phone.strip()))

def validate_e164(phone: str, field_name: str = "phone") -> None:
    """Raises ValueError if phone number is not valid E.164."""
    if not is_valid_e164(phone):
        raise ValueError(f"{field_name} must be a valid E.164 phone number, got: {phone!r}")

def assert_timezone_aware(dt: datetime, field_name: str = "datetime") -> None:
    """Raises ValueError if datetime is naive (missing timezone)."""
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        raise ValueError(f"{field_name} must be timezone-aware (tzinfo cannot be None)")
