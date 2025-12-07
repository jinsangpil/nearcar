"""
운영자 관리 관련 스키마
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import date


class VehicleMasterCreateRequest(BaseModel):
    """차량 마스터 생성 요청 스키마"""
    origin: str = Field(..., description="국산/수입", pattern="^(domestic|imported)$")
    manufacturer: str = Field(..., description="제조사", min_length=1, max_length=50)
    model_group: str = Field(..., description="모델 그룹", min_length=1, max_length=100)
    model_detail: Optional[str] = Field(None, description="모델 상세", max_length=100)
    vehicle_class: str = Field(..., description="차량 등급", pattern="^(compact|small|mid|large|suv|sports|supercar)$")
    start_year: int = Field(..., description="출시 시작 연도", ge=1900)
    end_year: Optional[int] = Field(None, description="출시 종료 연도", ge=1900)
    
    class Config:
        json_schema_extra = {
            "example": {
                "origin": "domestic",
                "manufacturer": "Hyundai",
                "model_group": "Grandeur",
                "model_detail": "The New Grandeur",
                "vehicle_class": "large",
                "start_year": 2019
            }
        }


class PricePolicyCreateRequest(BaseModel):
    """가격 정책 생성 요청 스키마"""
    origin: str = Field(..., description="국산/수입", pattern="^(domestic|imported)$")
    vehicle_class: str = Field(..., description="차량 등급", pattern="^(compact|small|mid|large|suv|sports|supercar)$")
    add_amount: int = Field(..., description="추가 금액", ge=0)
    
    class Config:
        json_schema_extra = {
            "example": {
                "origin": "imported",
                "vehicle_class": "supercar",
                "add_amount": 100000
            }
        }


class InspectionListQuery(BaseModel):
    """신청 목록 조회 쿼리 파라미터"""
    status: Optional[str] = Field(default=None, description="상태 필터")
    region: Optional[str] = Field(default=None, description="지역 필터")
    date: Optional[str] = Field(default=None, description="날짜 필터 (YYYY-MM-DD 형식)")
    page: int = Field(default=1, description="페이지 번호", ge=1)
    limit: int = Field(default=20, description="페이지 크기", ge=1, le=100)
    sort_by: Optional[str] = Field(default="created_at", description="정렬 기준")
    sort_order: Optional[str] = Field(default="desc", description="정렬 순서", pattern="^(asc|desc)$")


class InspectionAssignRequest(BaseModel):
    """기사 배정 요청 스키마"""
    inspector_id: str = Field(..., description="기사 ID")
    
    class Config:
        json_schema_extra = {
            "example": {
                "inspector_id": "user-insp-005"
            }
        }


class SettlementCalculateRequest(BaseModel):
    """정산 집계 요청 스키마"""
    target_date: date = Field(..., description="정산 기준일")
    
    class Config:
        json_schema_extra = {
            "example": {
                "target_date": "2025-12-04"
            }
        }

