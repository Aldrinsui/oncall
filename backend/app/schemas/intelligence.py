from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from backend.app.schemas.common import MetaEnvelope

class ShiftProgressDTO(BaseModel):
    calls_completed: int = Field(ge=0)
    calls_total: int = Field(ge=0)
    pct: int = Field(ge=0, le=100)

class ShiftPaceDTO(BaseModel):
    status: str
    expected_by_now: int = Field(ge=0)
    diff: int

class ConversionsDTO(BaseModel):
    count: int = Field(ge=0)
    rate: float = Field(ge=0.0, le=100.0)

class EarningsDTO(BaseModel):
    amount: int = Field(ge=0)
    currency: str = "INR"

class DashboardMetricsDTO(BaseModel):
    shift_progress: ShiftProgressDTO
    shift_pace: ShiftPaceDTO
    avg_talk_time_seconds: int = Field(ge=0)
    conversions: ConversionsDTO
    earnings: EarningsDTO

class DashboardMetricsResponse(BaseModel):
    data: DashboardMetricsDTO
    meta: MetaEnvelope

class ChartDataPointDTO(BaseModel):
    day: str
    calls: int = Field(ge=0)
    talk_time_minutes: float = Field(ge=0.0)
    conversions: int = Field(ge=0)

class DashboardChartsResponse(BaseModel):
    data: List[ChartDataPointDTO]
    meta: MetaEnvelope

class AvaniQueryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str = Field(min_length=1, max_length=1000)

class AvaniQueryData(BaseModel):
    intent: str
    response_text: str
    confidence: float = Field(ge=0.0, le=1.0)
    action_card: Optional[Dict[str, Any]] = None

class AvaniQueryResponse(BaseModel):
    data: AvaniQueryData
    meta: MetaEnvelope
