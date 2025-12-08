"""
알림 관련 스키마
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime


class NotificationSendRequest(BaseModel):
    """알림 발송 요청 스키마"""
    user_id: str = Field(..., min_length=1, description="수신자 ID")
    channel: str = Field(..., description="채널", pattern="^(alimtalk|sms|email|slack)$")
    template_id: Optional[str] = Field(None, description="템플릿 ID")
    template_name: Optional[str] = Field(None, description="템플릿 이름 (template_id 대신 사용 가능)")
    data: Dict[str, Any] = Field(default_factory=dict, description="템플릿 변수 데이터")
    
    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "uuid-here",
                "channel": "alimtalk",
                "template_id": "inspection_completed",
                "data": {
                    "inspection_id": "uuid-here",
                    "customer_name": "홍길동"
                }
            }
        }


class NotificationStatusResponse(BaseModel):
    """알림 상태 응답 스키마"""
    notification_id: int
    status: str
    channel: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class NotificationHistoryQuery(BaseModel):
    """알림 이력 조회 쿼리 파라미터"""
    user_id: Optional[str] = Field(None, description="사용자 ID 필터")
    channel: Optional[str] = Field(None, description="채널 필터")
    status: Optional[str] = Field(None, description="상태 필터")
    page: int = Field(1, description="페이지 번호", ge=1)
    limit: int = Field(20, description="페이지 크기", ge=1, le=100)


class NotificationHistoryResponse(BaseModel):
    """알림 이력 응답 스키마"""
    id: int
    user_id: str
    channel: str
    template_id: Optional[str]
    content: str
    status: str
    created_at: datetime
    sent_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class NotificationStatsResponse(BaseModel):
    """알림 통계 응답 스키마"""
    total: int = Field(..., description="전체 알림 수")
    by_channel: Dict[str, int] = Field(..., description="채널별 알림 수")
    by_status: Dict[str, int] = Field(..., description="상태별 알림 수")
    
    class Config:
        json_schema_extra = {
            "example": {
                "total": 1000,
                "by_channel": {
                    "alimtalk": 600,
                    "sms": 300,
                    "email": 100
                },
                "by_status": {
                    "sent": 950,
                    "failed": 50
                }
            }
        }


class NotificationTemplateCreateRequest(BaseModel):
    """알림 템플릿 생성 요청 스키마"""
    name: str = Field(..., description="템플릿 이름")
    channel: str = Field(..., description="채널 (alimtalk, sms, email)")
    template_id: Optional[str] = Field(None, description="외부 서비스 템플릿 ID")
    subject: Optional[str] = Field(None, description="이메일 제목 (이메일 채널용)")
    content: str = Field(..., description="템플릿 내용 (Jinja2 형식)")
    variables: Optional[List[str]] = Field(default_factory=list, description="사용 가능한 변수 목록")


class NotificationTemplateResponse(BaseModel):
    """알림 템플릿 응답 스키마"""
    id: str = Field(..., description="템플릿 ID")
    name: str = Field(..., description="템플릿 이름")
    channel: str = Field(..., description="채널")
    template_id: Optional[str] = Field(None, description="외부 서비스 템플릿 ID")
    subject: Optional[str] = Field(None, description="이메일 제목")
    content: str = Field(..., description="템플릿 내용")
    variables: List[str] = Field(default_factory=list, description="사용 가능한 변수 목록")
    created_at: datetime = Field(..., description="생성 시간")
    updated_at: datetime = Field(..., description="업데이트 시간")

