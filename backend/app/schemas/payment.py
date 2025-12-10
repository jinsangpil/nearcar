"""
결제 관련 스키마
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class PaymentRequestRequest(BaseModel):
    """결제 요청 스키마"""
    inspection_id: str = Field(..., description="진단 신청 ID")
    amount: int = Field(..., description="결제 금액", gt=0)
    customer_info: dict = Field(..., description="고객 정보")
    
    class Config:
        json_schema_extra = {
            "example": {
                "inspection_id": "uuid-here",
                "amount": 100000,
                "customer_info": {
                    "name": "홍길동",
                    "phone": "010-1234-5678"
                }
            }
        }


class PaymentRequestResponse(BaseModel):
    """결제 요청 응답 스키마 (KCP)"""
    order_id: str = Field(..., description="주문 ID")
    approval_key: Optional[str] = Field(None, description="KCP 승인 키")
    pay_url: str = Field(..., description="KCP 결제창 URL")
    amount: int = Field(..., description="결제 금액")
    
    class Config:
        json_schema_extra = {
            "example": {
                "order_id": "inspection-uuid-1234567890",
                "approval_key": "approval_key_here",
                "pay_url": "https://stg-spl.kcp.co.kr/...",
                "amount": 100000
            }
        }


class PaymentConfirmRequest(BaseModel):
    """결제 확인 요청 스키마 (KCP)"""
    order_id: str = Field(..., description="주문 ID")
    approval_key: Optional[str] = Field(None, description="KCP 승인 키")
    tno: Optional[str] = Field(None, description="KCP 거래번호")
    res_cd: Optional[str] = Field(None, description="결과 코드 (0000: 성공)")
    res_msg: Optional[str] = Field(None, description="결과 메시지")
    amount: Optional[int] = Field(None, description="결제 금액 (검증용)", gt=0)
    
    class Config:
        json_schema_extra = {
            "example": {
                "order_id": "inspection-uuid-1234567890",
                "approval_key": "approval_key_here",
                "tno": "KCP1234567890",
                "res_cd": "0000",
                "res_msg": "정상처리",
                "amount": 100000
            }
        }


class PaymentConfirmResponse(BaseModel):
    """결제 승인 응답 스키마"""
    payment_id: str = Field(..., description="결제 ID")
    transaction_id: str = Field(..., description="거래 고유 번호")
    status: str = Field(..., description="결제 상태")
    amount: int = Field(..., description="결제 금액")
    paid_at: Optional[datetime] = Field(None, description="결제 완료 시간")
    
    class Config:
        json_schema_extra = {
            "example": {
                "payment_id": "uuid-here",
                "transaction_id": "tgen_xxxxxxxxxxxxx",
                "status": "paid",
                "amount": 100000,
                "paid_at": "2025-12-07T10:00:00Z"
            }
        }


class PaymentStatusResponse(BaseModel):
    """결제 상태 조회 응답 스키마"""
    payment_id: str
    inspection_id: str
    amount: int
    method: str
    pg_provider: str
    transaction_id: Optional[str]
    status: str
    paid_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class PaymentCancelRequest(BaseModel):
    """결제 취소 요청 스키마"""
    cancel_reason: str = Field(..., description="취소 사유", min_length=1, max_length=200)
    cancel_amount: Optional[int] = Field(None, description="취소 금액 (부분 취소 시, 전체 취소는 None)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "cancel_reason": "고객 요청",
                "cancel_amount": None  # 전체 취소
            }
        }


class PaymentCancelResponse(BaseModel):
    """결제 취소 응답 스키마"""
    payment_id: str = Field(..., description="결제 ID")
    status: str = Field(..., description="취소 후 상태")
    cancelled_amount: int = Field(..., description="취소 금액")
    cancel_reason: str = Field(..., description="취소 사유")
    
    class Config:
        json_schema_extra = {
            "example": {
                "payment_id": "uuid-here",
                "status": "cancelled",
                "cancelled_amount": 100000,
                "cancel_reason": "고객 요청"
            }
        }


class PaymentStatisticsResponse(BaseModel):
    """결제 통계 응답 스키마"""
    period: dict
    summary: dict
    by_status: dict
    by_method: dict
    daily_trend: list


class PaymentMonitoringResponse(BaseModel):
    """결제 모니터링 응답 스키마"""
    today: dict
    yesterday: dict
    change_rate: dict
    pending_count: int
    failed_count_24h: int
    updated_at: str


class PaymentStatusUpdateRequest(BaseModel):
    """결제 상태 변경 요청 스키마"""
    new_status: str = Field(..., description="새 상태 (pending, paid, failed, cancelled, refunded)")
    update_inspection: bool = Field(True, description="Inspection 상태도 자동 업데이트할지 여부")
    
    class Config:
        json_schema_extra = {
            "example": {
                "new_status": "paid",
                "update_inspection": True
            }
        }

