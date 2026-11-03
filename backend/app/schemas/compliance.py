from datetime import datetime
from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel, Field
from backend.app.domains.common.enums import ConsentState, ConsentMethod
from backend.app.schemas.common import MetaEnvelope

class ConsentRequest(BaseModel):
    status: ConsentState
    method: ConsentMethod
    verified_text: Optional[str] = None

class ConsentDTO(BaseModel):
    id: UUID
    call_id: UUID
    status: ConsentState
    method: ConsentMethod
    verified_text: Optional[str] = None
    requested_at: datetime
    consented_at: Optional[datetime] = None

class ConsentResponse(BaseModel):
    data: ConsentDTO
    meta: MetaEnvelope

class SopItemReviewDTO(BaseModel):
    criterion: str
    passed: bool
    score: int = Field(default=0, ge=0, le=100)
    evidence: str

class SopReviewDTO(BaseModel):
    call_id: UUID
    overall_score: int = Field(default=0, ge=0, le=100)
    items: List[SopItemReviewDTO] = Field(default_factory=list)

class SopReviewResponse(BaseModel):
    data: SopReviewDTO
    meta: MetaEnvelope

class SubmitSopReviewRequest(BaseModel):
    items: List[SopItemReviewDTO]
