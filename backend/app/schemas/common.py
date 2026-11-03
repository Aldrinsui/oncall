from datetime import datetime, timezone
from uuid import UUID, uuid4
from typing import Generic, TypeVar, Optional, Any, Dict
from pydantic import BaseModel, Field

T = TypeVar("T")

class MetaEnvelope(BaseModel):
    request_id: UUID = Field(default_factory=uuid4)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ErrorBody(BaseModel):
    code: str
    message: str
    details: Optional[Dict[str, Any]] = None

class ErrorResponse(BaseModel):
    error: ErrorBody
    meta: MetaEnvelope

class AckData(BaseModel):
    success: bool = True

class AckResponse(BaseModel):
    data: AckData = Field(default_factory=AckData)
    meta: MetaEnvelope

class DataResponse(BaseModel, Generic[T]):
    data: T
    meta: MetaEnvelope
