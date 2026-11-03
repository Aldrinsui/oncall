from datetime import datetime
from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from backend.app.domains.common.enums import ConsentState, ConsentDecision, ConsentMethod
from backend.app.schemas.common import MetaEnvelope

class ConsentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: ConsentDecision
    method: ConsentMethod
    verified_text: Optional[str] = Field(default=None, max_length=2000)

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
    criterion: str = Field(min_length=1, max_length=255)
    passed: bool
    score: int = Field(default=0, ge=0, le=100)
    evidence: str = Field(min_length=1, max_length=2000)

class SopReviewDTO(BaseModel):
    call_id: UUID
    overall_score: int = Field(default=0, ge=0, le=100)
    items: List[SopItemReviewDTO] = Field(default_factory=list)

class SopReviewResponse(BaseModel):
    data: SopReviewDTO
    meta: MetaEnvelope

class SubmitSopReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: List[SopItemReviewDTO]
