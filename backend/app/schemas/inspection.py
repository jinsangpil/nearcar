"""
진단 신청 관련 스키마
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import date, time, datetime


class InspectionCreateRequest(BaseModel):
    """진단 신청 생성 요청 스키마"""
    vehicle_master_id: str = Field(..., description="차량 마스터 ID")
    plate_number: str = Field(..., description="차량번호", min_length=1, max_length=20)
    year: int = Field(..., description="연식", ge=1900)
    mileage: Optional[int] = Field(None, description="주행거리", ge=0)
    location_address: str = Field(..., description="진단 장소 주소", min_length=1)
    region_id: str = Field(..., description="서비스 지역 ID")
    preferred_schedule: datetime = Field(..., description="희망 일정")
    package_id: str = Field(..., description="패키지 ID")
    total_amount: int = Field(..., description="총액", gt=0)
    
    class Config:
        json_schema_extra = {
            "example": {
                "vehicle_master_id": "uuid-here",
                "plate_number": "12가3456",
                "year": 2020,
                "mileage": 45000,
                "location_address": "서울시 강남구 역삼동...",
                "region_id": "uuid-here",
                "preferred_schedule": "2025-12-03T10:00:00",
                "package_id": "uuid-here",
                "total_amount": 85000
            }
        }


class InspectionCreateResponse(BaseModel):
    """진단 신청 생성 응답 스키마"""
    inspection_id: str = Field(..., description="진단 신청 ID")
    status: str = Field(..., description="신청 상태")
    
    class Config:
        json_schema_extra = {
            "example": {
                "inspection_id": "uuid-here",
                "status": "requested"
            }
        }


class InspectorInfo(BaseModel):
    """기사 정보 스키마"""
    name: str
    phone: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "김기사",
                "phone": "010-xxxx-xxxx"
            }
        }


class ReportSummary(BaseModel):
    """레포트 요약 스키마"""
    result: Optional[str] = None  # good, warning, bad
    pdf_url: Optional[str] = None
    web_view_url: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "result": "good",
                "pdf_url": "https://s3.aws.com/reports/123.pdf",
                "web_view_url": "/report/view/123"
            }
        }


class InspectionDetailResponse(BaseModel):
    """진단 신청 상세 응답 스키마"""
    status: str = Field(..., description="신청 상태")
    inspector: Optional[InspectorInfo] = Field(None, description="배정된 기사 정보")
    vehicle_info: str = Field(..., description="차량 정보")
    report_summary: Optional[ReportSummary] = Field(None, description="레포트 요약")
    
    class Config:
        json_schema_extra = {
            "example": {
                "status": "report_sent",
                "inspector": {
                    "name": "김기사",
                    "phone": "010-xxxx-xxxx"
                },
                "vehicle_info": "그랜저 IG (12가3456)",
                "report_summary": {
                    "result": "good",
                    "pdf_url": "https://s3.aws.com/reports/123.pdf",
                    "web_view_url": "/report/view/123"
                }
            }
        }


class AssignmentResponse(BaseModel):
    """배정 정보 응답 스키마"""
    id: str
    location: str
    vehicle: str
    schedule: str
    fee: int
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "insp-123",
                "location": "서울 강남구",
                "vehicle": "BMW 520d",
                "schedule": "2025-12-03 14:00",
                "fee": 45000
            }
        }


class AssignmentAcceptRequest(BaseModel):
    """배정 수락 요청 스키마"""
    pass  # 추가 파라미터 없음


class AssignmentRejectRequest(BaseModel):
    """배정 거절 요청 스키마"""
    reason: str = Field(..., description="거절 사유", min_length=1, max_length=200)
    
    class Config:
        json_schema_extra = {
            "example": {
                "reason": "일정 충돌"
            }
        }


class InspectionStatusUpdateRequest(BaseModel):
    """작업 상태 변경 요청 스키마"""
    new_status: str = Field(..., description="새 상태 (scheduled, in_progress, report_submitted)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "new_status": "in_progress"
            }
        }

