"""
서비스 지역 스키마
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ServiceRegionBase(BaseModel):
    """서비스 지역 기본 스키마"""
    province: str = Field(..., description="상위 지역 (도/광역시)", min_length=1, max_length=50)
    province_code: Optional[str] = Field(None, description="광역시도 코드 (11, 21, 22 등)", max_length=2)
    city: str = Field(..., description="하위 지역 (시/구)", min_length=1, max_length=50)
    city_code: Optional[str] = Field(None, description="시군구 코드", max_length=5)
    extra_fee: int = Field(..., description="추가 요금 (원 단위)", ge=0)
    is_active: bool = Field(True, description="활성 상태")


class ServiceRegionCreateRequest(ServiceRegionBase):
    """서비스 지역 생성 요청 스키마"""
    pass


class ServiceRegionUpdateRequest(BaseModel):
    """서비스 지역 수정 요청 스키마"""
    province: Optional[str] = Field(None, description="상위 지역", min_length=1, max_length=50)
    province_code: Optional[str] = Field(None, description="광역시도 코드", max_length=2)
    city: Optional[str] = Field(None, description="하위 지역", min_length=1, max_length=50)
    city_code: Optional[str] = Field(None, description="시군구 코드", max_length=5)
    extra_fee: Optional[int] = Field(None, description="추가 요금", ge=0)
    is_active: Optional[bool] = Field(None, description="활성 상태")


class ServiceRegionResponse(ServiceRegionBase):
    """서비스 지역 응답 스키마"""
    id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ServiceRegionListResponse(BaseModel):
    """서비스 지역 목록 응답 스키마"""
    items: List[ServiceRegionResponse]
    total: int
    page: int
    limit: int
    total_pages: int


class ServiceRegionHierarchyResponse(BaseModel):
    """서비스 지역 계층 구조 응답 스키마"""
    province: str
    cities: List[ServiceRegionResponse]

