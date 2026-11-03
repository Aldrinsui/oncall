import pytest
import yaml

from backend.app.domains.common.enums import (
    EndpointType,
    AgentEndpointType,
    AGENT_ENDPOINT_TO_LEG_TYPE,
)
from backend.app.domains.telephony.base import resolve_agent_leg_endpoint_type

def test_openapi_endpoint_and_operation_counts():
    """Verify OpenAPI has exactly 38 unique paths and 45 operations matching Section 9."""
    with open("docs/openapi.yaml", "r", encoding="utf-8") as f:
        spec = yaml.safe_load(f)

    paths = spec.get("paths", {})
    assert len(paths) == 38, f"Expected 38 unique paths, found {len(paths)}"

    operations = []
    for path, methods in paths.items():
        for m in ["get", "post", "put", "patch", "delete"]:
            if m in methods:
                operations.append(f"{m.upper()} {path}")

    assert len(operations) == 45, f"Expected 45 operations, found {len(operations)}"

def test_openapi_pulse_store_403_responses_documented():
    """Verify that protected Pulse endpoints document 403 ForbiddenError responses."""
    with open("docs/openapi.yaml", "r", encoding="utf-8") as f:
        spec = yaml.safe_load(f)

    pulse_protected_endpoints = [
        ("get", "/pulse/channels/{id}/messages"),
        ("post", "/pulse/channels/{id}/messages"),
        ("post", "/pulse/channels/{id}/read"),
        ("get", "/pulse/channels/{id}/pinned-items"),
        ("post", "/pulse/pinned-items/{id}/respond"),
    ]

    for method, path in pulse_protected_endpoints:
        op = spec["paths"][path][method]
        assert "403" in op["responses"], f"Missing 403 response on {method.upper()} {path}"
        assert op["responses"]["403"]["$ref"] == "#/components/responses/ForbiddenError"

def test_openapi_call_terminate_conditional_semantics_documented():
    """Verify /calls/{id}/terminate documents conditional transitions."""
    with open("docs/openapi.yaml", "r", encoding="utf-8") as f:
        spec = yaml.safe_load(f)

    term_op = spec["paths"]["/calls/{id}/terminate"]["post"]
    description = term_op.get("description", "")
    assert "WRAPUP" in description
    assert "CANCELLED" in description
    assert "terminal" in description

def test_agent_endpoint_type_mapping():
    """Verify explicit mapping from AgentEndpointType to EndpointType."""
    assert resolve_agent_leg_endpoint_type(AgentEndpointType.WEBRTC_MOCK) == EndpointType.WEBRTC
    assert resolve_agent_leg_endpoint_type(AgentEndpointType.SIP_URI) == EndpointType.SIP
    assert resolve_agent_leg_endpoint_type(AgentEndpointType.PSTN_PHONE) == EndpointType.PSTN

    assert AGENT_ENDPOINT_TO_LEG_TYPE[AgentEndpointType.WEBRTC_MOCK.value] == EndpointType.WEBRTC
    assert AGENT_ENDPOINT_TO_LEG_TYPE[AgentEndpointType.SIP_URI.value] == EndpointType.SIP
    assert AGENT_ENDPOINT_TO_LEG_TYPE[AgentEndpointType.PSTN_PHONE.value] == EndpointType.PSTN

    with pytest.raises(ValueError):
        resolve_agent_leg_endpoint_type("UNKNOWN_ENDPOINT_TYPE")
