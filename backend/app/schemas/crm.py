from datetime import datetime
from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel, Field
from backend.app.schemas.common import MetaEnvelope

class CustomerDTO(BaseModel):
    id: UUID
    name: str
    phone_e164: str
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
    customer_phone: str
    assigned_agent_id: Optional[UUID] = None
    interest: str
    product: str
    cross_sell: Optional[str] = None
    emi_note: Optional[str] = None
    attractiveness_score: int = Field(default=50, ge=0, le=100)
    expected_value: float = Field(default=0.0, ge=0.0)
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
    status_label: Optional[str] = None
    notes: Optional[str] = None
    assigned_agent_id: Optional[UUID] = None
