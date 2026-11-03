from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from backend.app.schemas.common import MetaEnvelope

class ShiftProgressDTO(BaseModel):
    calls_completed: int
    calls_total: int
    pct: int

class ShiftPaceDTO(BaseModel):
    status: str
    expected_by_now: int
    diff: int

class ConversionsDTO(BaseModel):
    count: int
    rate: float

class EarningsDTO(BaseModel):
    amount: int
    currency: str = "INR"

class DashboardMetricsDTO(BaseModel):
    shift_progress: ShiftProgressDTO
    shift_pace: ShiftPaceDTO
    avg_talk_time_seconds: int
    conversions: ConversionsDTO
    earnings: EarningsDTO

class DashboardMetricsResponse(BaseModel):
    data: DashboardMetricsDTO
    meta: MetaEnvelope

class ChartDataPointDTO(BaseModel):
    day: str
    calls: int
    talk_time_minutes: float
    conversions: int

class DashboardChartsResponse(BaseModel):
    data: List[ChartDataPointDTO]
    meta: MetaEnvelope

class AvaniQueryRequest(BaseModel):
    query: str

class AvaniQueryData(BaseModel):
    intent: str
    response_text: str
    confidence: float
    action_card: Optional[Dict[str, Any]] = None

class AvaniQueryResponse(BaseModel):
    data: AvaniQueryData
    meta: MetaEnvelope
