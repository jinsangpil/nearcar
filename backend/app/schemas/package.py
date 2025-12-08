"""
패키지 스키마
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime


class PackageBase(BaseModel):
    """패키지 기본 스키마"""
    name: str = Field(..., description="패키지 이름", max_length=50)
    base_price: int = Field(..., description="기본 가격", ge=0)
    included_items: Dict[str, Any] = Field(
        default_factory=dict,
        description="포함 항목 (JSONB 구조)"
    )


class PackageCreateRequest(PackageBase):
    """패키지 생성 요청 스키마"""
    pass


class PackageUpdateRequest(BaseModel):
    """패키지 수정 요청 스키마"""
    name: Optional[str] = Field(None, description="패키지 이름", max_length=50)
    base_price: Optional[int] = Field(None, description="기본 가격", ge=0)
    included_items: Optional[Dict[str, Any]] = Field(None, description="포함 항목")
    is_active: Optional[bool] = Field(None, description="활성화 여부")


class PackageResponse(PackageBase):
    """패키지 응답 스키마"""
    id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class PackageListResponse(BaseModel):
    """패키지 목록 응답 스키마"""
    items: List[PackageResponse]
    total: int
    page: int
    limit: int
    total_pages: int

