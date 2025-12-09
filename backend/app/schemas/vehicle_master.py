"""
차량 마스터 관리 스키마
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class VehicleMasterCreateRequest(BaseModel):
    """차량 마스터 생성 요청 스키마"""
    origin: str = Field(..., description="국산/수입", pattern="^(domestic|imported)$")
    manufacturer: str = Field(..., description="제조사", min_length=1, max_length=50)
    model_group: str = Field(..., description="모델 그룹", min_length=1, max_length=100)
    model_detail: Optional[str] = Field(None, description="모델 상세", max_length=100)
    vehicle_class: str = Field(..., description="차량 등급", pattern="^(compact|small|mid|large|suv|sports|supercar)$")
    start_year: int = Field(..., description="출시 시작 연도", ge=1900, le=2100)
    end_year: Optional[int] = Field(None, description="출시 종료 연도", ge=1900, le=2100)
    is_active: bool = Field(True, description="활성화 여부")
    
    class Config:
        json_schema_extra = {
            "example": {
                "origin": "domestic",
                "manufacturer": "Hyundai",
                "model_group": "Grandeur",
                "model_detail": "The New Grandeur",
                "vehicle_class": "large",
                "start_year": 2019,
                "end_year": None,
                "is_active": True
            }
        }


class VehicleMasterUpdateRequest(BaseModel):
    """차량 마스터 수정 요청 스키마"""
    origin: Optional[str] = Field(None, description="국산/수입", pattern="^(domestic|imported)$")
    manufacturer: Optional[str] = Field(None, description="제조사", min_length=1, max_length=50)
    model_group: Optional[str] = Field(None, description="모델 그룹", min_length=1, max_length=100)
    model_detail: Optional[str] = Field(None, description="모델 상세", max_length=100)
    vehicle_class: Optional[str] = Field(None, description="차량 등급", pattern="^(compact|small|mid|large|suv|sports|supercar)$")
    start_year: Optional[int] = Field(None, description="출시 시작 연도", ge=1900, le=2100)
    end_year: Optional[int] = Field(None, description="출시 종료 연도", ge=1900, le=2100)
    is_active: Optional[bool] = Field(None, description="활성화 여부")


class VehicleMasterResponse(BaseModel):
    """차량 마스터 응답 스키마"""
    id: UUID
    origin: str
    manufacturer: str
    model_group: str
    model_detail: Optional[str]
    vehicle_class: str
    start_year: int
    end_year: Optional[int]
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class VehicleMasterListResponse(BaseModel):
    """차량 마스터 목록 응답 스키마"""
    items: List[VehicleMasterResponse]
    total: int
    page: int
    limit: int
    total_pages: int


class VehicleMasterSyncRequest(BaseModel):
    """차량 마스터 동기화 요청 스키마"""
    data: List[VehicleMasterCreateRequest] = Field(..., description="동기화할 차량 마스터 데이터 목록")
    
    class Config:
        json_schema_extra = {
            "example": {
                "data": [
                    {
                        "origin": "domestic",
                        "manufacturer": "Hyundai",
                        "model_group": "Grandeur",
                        "model_detail": "The New Grandeur",
                        "vehicle_class": "large",
                        "start_year": 2019,
                        "end_year": None,
                        "is_active": True
                    }
                ]
            }
        }


class VehicleMasterSyncResponse(BaseModel):
    """차량 마스터 동기화 응답 스키마"""
    created: int = Field(..., description="생성된 건수")
    updated: int = Field(..., description="업데이트된 건수")
    failed: int = Field(..., description="실패한 건수")
    errors: List[str] = Field(default_factory=list, description="에러 메시지 목록")

