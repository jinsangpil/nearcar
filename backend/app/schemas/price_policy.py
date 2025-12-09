"""
가격 정책 스키마
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class PricePolicyBase(BaseModel):
    """가격 정책 기본 스키마"""
    origin: str = Field(..., description="국산/수입", pattern="^(domestic|imported)$")
    vehicle_class: str = Field(
        ..., 
        description="차량 등급", 
        pattern="^(compact|small|mid|large|suv|sports|supercar)$"
    )
    add_amount: int = Field(..., description="추가 금액", ge=0)


class PricePolicyCreateRequest(PricePolicyBase):
    """가격 정책 생성 요청 스키마"""
    pass


class PricePolicyUpdateRequest(BaseModel):
    """가격 정책 수정 요청 스키마"""
    add_amount: Optional[int] = Field(None, description="추가 금액", ge=0)


class PricePolicyResponse(PricePolicyBase):
    """가격 정책 응답 스키마"""
    id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class PricePolicyListResponse(BaseModel):
    """가격 정책 목록 응답 스키마"""
    items: List[PricePolicyResponse]
    total: int
    page: int
    limit: int
    total_pages: int

