"""
정산 관련 스키마
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal


class SettlementResponse(BaseModel):
    """정산 응답 스키마"""
    id: str
    inspector_id: str
    inspector_name: Optional[str] = None
    inspection_id: str
    total_sales: int
    fee_rate: Decimal
    settle_amount: int
    status: str
    settle_date: date
    created_at: datetime
    
    class Config:
        from_attributes = True


class SettlementListResponse(BaseModel):
    """정산 목록 응답 스키마"""
    settlements: List[SettlementResponse]
    total: int
    page: int
    page_size: int


class SettlementDetailResponse(BaseModel):
    """정산 상세 응답 스키마"""
    settlement: SettlementResponse
    inspection_detail: Optional[dict] = None
    inspector_detail: Optional[dict] = None


class SettlementSummaryResponse(BaseModel):
    """정산 요약 응답 스키마"""
    total_pending_amount: int = Field(..., description="미정산 총액")
    total_completed_amount: int = Field(..., description="정산완료 총액")
    pending_count: int = Field(..., description="미정산 건수")
    completed_count: int = Field(..., description="정산완료 건수")
    inspector_summary: List[dict] = Field(..., description="기사별 정산 요약")
    daily_summary: List[dict] = Field(..., description="일별 정산 요약")
    weekly_summary: List[dict] = Field(..., description="주별 정산 요약")
    monthly_summary: List[dict] = Field(..., description="월별 정산 요약")


class SettlementStatusUpdateRequest(BaseModel):
    """정산 상태 변경 요청 스키마"""
    status: str = Field(..., description="새 상태 (pending, completed)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "status": "completed"
            }
        }


class SettlementBulkUpdateRequest(BaseModel):
    """정산 일괄 상태 변경 요청 스키마"""
    settlement_ids: List[str] = Field(..., description="정산 ID 목록")
    status: str = Field(..., description="새 상태 (pending, completed)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "settlement_ids": ["uuid-1", "uuid-2"],
                "status": "completed"
            }
        }

