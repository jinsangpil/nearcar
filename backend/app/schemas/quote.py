"""
견적 관련 스키마
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID


class QuoteCalculateRequest(BaseModel):
    """견적 계산 요청 스키마"""
    vehicle_master_id: str = Field(..., description="차량 마스터 ID")
    package_id: str = Field(..., description="패키지 ID")
    region_id: str = Field(..., description="서비스 지역 ID")
    
    class Config:
        json_schema_extra = {
            "example": {
                "vehicle_master_id": "uuid-here",
                "package_id": "uuid-here",
                "region_id": "uuid-here"
            }
        }


class QuoteCalculateResponse(BaseModel):
    """견적 계산 응답 스키마"""
    base_price: int = Field(..., description="기본 패키지 가격")
    class_surcharge: int = Field(..., description="차종 할증 금액")
    region_fee: int = Field(..., description="지역 출장비")
    total_amount: int = Field(..., description="총액 (10원 단위 반올림)")
    vehicle_class: str = Field(..., description="차량 등급")
    origin: str = Field(..., description="국산/수입 구분")
    
    class Config:
        json_schema_extra = {
            "example": {
                "base_price": 100000,
                "class_surcharge": 10000,
                "region_fee": 5000,
                "total_amount": 115000,
                "vehicle_class": "large",
                "origin": "domestic"
            }
        }


class PackageResponse(BaseModel):
    """패키지 응답 스키마"""
    id: str
    name: str
    base_price: int
    included_items: Dict[str, Any]
    is_active: bool
    
    class Config:
        from_attributes = True


class RegionResponse(BaseModel):
    """지역 응답 스키마"""
    id: str
    province: str
    city: str
    extra_fee: int
    is_active: bool
    
    class Config:
        from_attributes = True


class RegionHierarchyResponse(BaseModel):
    """계층형 지역 응답 스키마"""
    province: str
    cities: List[Dict[str, Any]]
    
    class Config:
        json_schema_extra = {
            "example": {
                "province": "서울",
                "cities": [
                    {"id": "uuid", "city": "강남구", "extra_fee": 0},
                    {"id": "uuid", "city": "서초구", "extra_fee": 0}
                ]
            }
        }

