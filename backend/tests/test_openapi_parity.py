import pytest
import yaml

from backend.app.domains.common.enums import (
    EndpointType,
    AgentEndpointType,
    AGENT_ENDPOINT_TO_LEG_TYPE,
    CallStatus,
    CallDirection,
    CallLegRole,
    CallLegStatus,
)
from backend.app.domains.telephony.base import resolve_agent_leg_endpoint_type
from backend.app.schemas.identity import AgentDTO
from backend.app.schemas.crm import LeadDTO
from backend.app.schemas.telephony import CallDTO, CallLegDTO
from backend.app.schemas.compliance import SopItemReviewDTO, SopReviewDTO

@pytest.fixture(scope="module")
def openapi_spec():
    with open("docs/openapi.yaml", "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def test_openapi_endpoint_and_operation_counts(openapi_spec):
    """Verify OpenAPI has exactly 38 unique paths and 45 operations matching Section 9."""
    paths = openapi_spec.get("paths", {})
    assert len(paths) == 38, f"Expected 38 unique paths, found {len(paths)}"

    operations = []
    for path, methods in paths.items():
        for m in ["get", "post", "put", "patch", "delete"]:
            if m in methods:
                operations.append(f"{m.upper()} {path}")

    assert len(operations) == 45, f"Expected 45 operations, found {len(operations)}"

def test_openapi_global_security_is_strictly_bearer_auth(openapi_spec):
    """
    Verify root security enforces BearerAuth ONLY in production and does NOT
    advertise DevAgentAuth as a global alternative credential (P0.1).
    """
    sec = openapi_spec.get("security", [])
    assert sec == [{"BearerAuth": []}], f"Expected strictly BearerAuth as global security, got: {sec}"

    # DevAgentAuth must be defined in components.securitySchemes as development-only
    schemes = openapi_spec["components"]["securitySchemes"]
    assert "BearerAuth" in schemes
    assert "DevAgentAuth" in schemes

    dev_desc = schemes["DevAgentAuth"].get("description", "")
    assert "development" in dev_desc.lower()
    assert "production" in dev_desc.lower()

def test_openapi_pulse_store_403_responses_documented(openapi_spec):
    """Verify that protected Pulse endpoints document 403 ForbiddenError responses."""
    pulse_protected_endpoints = [
        ("get", "/pulse/channels/{id}/messages"),
        ("post", "/pulse/channels/{id}/messages"),
        ("post", "/pulse/channels/{id}/read"),
        ("get", "/pulse/channels/{id}/pinned-items"),
        ("post", "/pulse/pinned-items/{id}/respond"),
    ]

    for method, path in pulse_protected_endpoints:
        op = openapi_spec["paths"][path][method]
        assert "403" in op["responses"], f"Missing 403 response on {method.upper()} {path}"
        assert op["responses"]["403"]["$ref"] == "#/components/responses/ForbiddenError"

def test_openapi_call_terminate_conditional_semantics_documented(openapi_spec):
    """Verify /calls/{id}/terminate documents conditional transitions."""
    term_op = openapi_spec["paths"]["/calls/{id}/terminate"]["post"]
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

def test_schema_constraint_parity_sop_reviews(openapi_spec):
    """Verify SopItemReviewDTO and SopReviewDTO have exact score constraint parity (P1.2)."""
    schemas = openapi_spec["components"]["schemas"]

    sop_item = schemas["SopItemReviewDTO"]["properties"]
    assert sop_item["score"]["type"] == "integer"
    assert sop_item["score"]["minimum"] == 0
    assert sop_item["score"]["maximum"] == 100

    sop_review = schemas["SopReviewDTO"]["properties"]
    assert sop_review["overall_score"]["type"] == "integer"
    assert sop_review["overall_score"]["minimum"] == 0
    assert sop_review["overall_score"]["maximum"] == 100

def test_schema_constraint_parity_avani_confidence(openapi_spec):
    """Verify Avani confidence has exact 0.0-1.0 numeric bound parity (P1.2)."""
    schemas = openapi_spec["components"]["schemas"]
    conf = schemas["AvaniQueryResponse"]["properties"]["data"]["properties"]["confidence"]
    assert conf["type"] == "number"
    assert conf["minimum"] == 0.0
    assert conf["maximum"] == 1.0

def test_schema_constraint_parity_lead_scores_and_monetary_values(openapi_spec):
    """Verify LeadDTO scores have 0-100 bounds and expected_value has non-negative bound (P1.2)."""
    schemas = openapi_spec["components"]["schemas"]
    lead = schemas["LeadDTO"]["properties"]

    assert lead["attractiveness_score"]["minimum"] == 0
    assert lead["attractiveness_score"]["maximum"] == 100
    assert lead["icp_score"]["minimum"] == 0
    assert lead["icp_score"]["maximum"] == 100
    assert lead["intent_score"]["minimum"] == 0
    assert lead["intent_score"]["maximum"] == 100
    assert lead["expected_value"]["minimum"] == 0.0
    assert lead["notes"]["type"] == ["string", "null"]

def test_schema_constraint_parity_agent_and_roleplay(openapi_spec):
    """Verify AgentDTO and RoleplaySessionDTO score bounds match Pydantic schemas (P1.2)."""
    schemas = openapi_spec["components"]["schemas"]

    agent = schemas["AgentDTO"]["properties"]
    assert agent["og_score"]["minimum"] == 0
    assert agent["og_score"]["maximum"] == 100
    assert set(agent["endpoint_type"]["enum"]) == {e.value for e in AgentEndpointType}

    roleplay = schemas["RoleplaySessionDTO"]["properties"]
    assert roleplay["score"]["minimum"] == 0
    assert roleplay["score"]["maximum"] == 100
    assert roleplay["turns_count"]["minimum"] == 0

def test_schema_field_parity_with_pydantic_models(openapi_spec):
    """Verify core Pydantic DTO fields match OpenAPI property definitions (P1.2)."""
    schemas = openapi_spec["components"]["schemas"]

    # AgentDTO parity
    agent_dto_fields = set(AgentDTO.model_fields.keys())
    agent_openapi_props = set(schemas["AgentDTO"]["properties"].keys())
    assert agent_dto_fields == agent_openapi_props

    # LeadDTO parity
    lead_dto_fields = set(LeadDTO.model_fields.keys())
    lead_openapi_props = set(schemas["LeadDTO"]["properties"].keys())
    assert lead_dto_fields == lead_openapi_props

    # CallDTO parity (ensuring is_simulated is excluded from both)
    call_dto_fields = set(CallDTO.model_fields.keys())
    call_openapi_props = set(schemas["CallDTO"]["properties"].keys())
    assert "is_simulated" not in call_dto_fields
    assert "is_simulated" not in call_openapi_props
    assert call_dto_fields == call_openapi_props

    # CallLegDTO parity
    leg_dto_fields = set(CallLegDTO.model_fields.keys())
    leg_openapi_props = set(schemas["CallLegDTO"]["properties"].keys())
    assert leg_dto_fields == leg_openapi_props
