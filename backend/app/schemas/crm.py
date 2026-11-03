from datetime import datetime
from decimal import Decimal
from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from backend.app.schemas.common import MetaEnvelope

class CustomerDTO(BaseModel):
    id: UUID
    name: str
    phone_e164: str = Field(pattern=r"^\+[1-9]\d{1,14}$")
    brand: str

class CustomerResponse(BaseModel):
    data: CustomerDTO
    meta: MetaEnvelope

class BuyingSignalDTO(BaseModel):
    id: UUID
    label: str
    detail: str
    icon: str
    detected_at: datetime

class LeadDTO(BaseModel):
    id: UUID
    customer_id: UUID
    customer_name: str
    customer_phone: str = Field(pattern=r"^\+[1-9]\d{1,14}$")
    assigned_agent_id: Optional[UUID] = None
    interest: str
    product: str
    cross_sell: Optional[str] = None
    emi_note: Optional[str] = None
    notes: Optional[str] = None
    attractiveness_score: int = Field(default=50, ge=0, le=100)
    expected_value: Decimal = Field(default_factory=lambda: Decimal("0.00"), ge=Decimal("0.00"))
    badge: str
    badge_color: str
    status_label: str
    icp_score: int = Field(default=50, ge=0, le=100)
    intent_score: int = Field(default=50, ge=0, le=100)
    source: str
    last_contact_at: Optional[datetime] = None
    buying_signals: List[BuyingSignalDTO] = Field(default_factory=list)

class LeadListResponse(BaseModel):
    data: List[LeadDTO]
    meta: MetaEnvelope

class LeadDetailResponse(BaseModel):
    data: LeadDTO
    meta: MetaEnvelope

class UpdateLeadRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status_label: Optional[str] = Field(default=None, max_length=100)
    notes: Optional[str] = Field(default=None, max_length=2000)
    assigned_agent_id: Optional[UUID] = None
