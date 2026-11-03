from datetime import datetime
from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel, Field
from backend.app.schemas.common import MetaEnvelope

class StartRoleplayRequest(BaseModel):
    persona_id: str

class RoleplayTurnRequest(BaseModel):
    agent_speech: str

class RoleplayTurnData(BaseModel):
    customer_speech: str
    stage: str
    objection_detected: bool
    sop_pass: bool

class RoleplayTurnResponse(BaseModel):
    data: RoleplayTurnData
    meta: MetaEnvelope

class RoleplaySessionDTO(BaseModel):
    id: UUID
    persona_id: str
    current_stage: str
    score: int = Field(default=0, ge=0, le=100)
    turns_count: int = Field(default=0, ge=0)
    closing_goal_met: bool = False
    started_at: datetime
    completed_at: Optional[datetime] = None

class RoleplaySessionResponse(BaseModel):
    data: RoleplaySessionDTO
    meta: MetaEnvelope

class RoleplayHistoryResponse(BaseModel):
    data: List[RoleplaySessionDTO]
    meta: MetaEnvelope
