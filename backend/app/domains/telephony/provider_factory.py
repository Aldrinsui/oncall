from backend.app.core.config import settings
from backend.app.domains.telephony.base import TelephonyProvider
from backend.app.domains.telephony.twilio_provider import TwilioTelephonyProvider
from backend.app.domains.telephony.plivo_provider import PlivoTelephonyProvider
from backend.app.domains.telephony.exotel_provider import ExotelTelephonyProvider
from backend.app.domains.telephony.mock_provider import MockTelephonyProvider

_provider_instance: TelephonyProvider | None = None

def get_telephony_provider(force_reload: bool = False) -> TelephonyProvider:
    global _provider_instance
    if _provider_instance is not None and not force_reload:
        return _provider_instance

    provider_name = settings.TELEPHONY_PROVIDER.lower().strip()
    if provider_name == "twilio":
        _provider_instance = TwilioTelephonyProvider()
    elif provider_name == "plivo":
        _provider_instance = PlivoTelephonyProvider()
    elif provider_name == "exotel":
        _provider_instance = ExotelTelephonyProvider()
    else:
        _provider_instance = MockTelephonyProvider()

    return _provider_instance

def set_telephony_provider(provider: TelephonyProvider) -> None:
    global _provider_instance
    _provider_instance = provider
