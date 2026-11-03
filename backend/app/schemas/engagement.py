from datetime import datetime
from uuid import UUID
from typing import List
from pydantic import BaseModel, Field
from backend.app.schemas.common import MetaEnvelope

class KudosDTO(BaseModel):
    id: UUID
    agent_id: UUID
    agent_name: str
    given_by_id: UUID
    given_by_name: str
    reason: str
    created_at: datetime
    likes_count: int = Field(default=0, ge=0)
    is_liked_by_me: bool = False

class KudosListResponse(BaseModel):
    data: List[KudosDTO]
    meta: MetaEnvelope

class KudosResponse(BaseModel):
    data: KudosDTO
    meta: MetaEnvelope

class CreateKudosRequest(BaseModel):
    agent_id: UUID
    reason: str

class KudosLikeData(BaseModel):
    kudos_id: UUID
    likes_count: int
    is_liked: bool

class KudosLikeResponse(BaseModel):
    data: KudosLikeData
    meta: MetaEnvelope
