"""
차량 관련 스키마
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class ManufacturerResponse(BaseModel):
    """제조사 응답 스키마"""
    id: str
    name: str
    origin: str
    
    class Config:
        from_attributes = True


class ModelGroupResponse(BaseModel):
    """모델 그룹 응답 스키마"""
    id: str
    name: str
    manufacturer: str
    
    class Config:
        from_attributes = True


class VehicleModelDetailResponse(BaseModel):
    """차량 모델 상세 응답 스키마"""
    id: str
    origin: str
    manufacturer: str
    model_group: str
    model_detail: Optional[str] = None
    vehicle_class: str
    start_year: int
    end_year: Optional[int] = None
    is_active: bool
    
    class Config:
        from_attributes = True


class VehicleClassResponse(BaseModel):
    """차량 등급 응답 스키마"""
    class_name: str
    display_name: str
    origin: Optional[str] = None
    
    class Config:
        from_attributes = True


class VehicleLookupResponse(BaseModel):
    """차량번호 조회 응답 스키마"""
    plate_number: str
    manufacturer: Optional[str] = None
    model_group: Optional[str] = None
    production_year: Optional[int] = None
    fuel_type: Optional[str] = None
    
    class Config:
        from_attributes = True


class StandardResponse(BaseModel):
    """표준 API 응답 스키마"""
    success: bool = True
    data: Optional[list] = None
    error: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": [],
                "error": None
            }
        }

