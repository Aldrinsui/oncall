from datetime import datetime
from uuid import UUID
from typing import Generic, TypeVar, Optional, Any, Dict
from pydantic import BaseModel, Field

T = TypeVar("T")

class MetaEnvelope(BaseModel):
    request_id: UUID
    timestamp: datetime

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
