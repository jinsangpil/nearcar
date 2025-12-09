"""
제조사 관리 스키마
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class ManufacturerCreateRequest(BaseModel):
    """제조사 생성 요청 스키마"""
    name: str = Field(..., description="제조사명", min_length=1, max_length=50)
    origin: str = Field(..., description="국산/수입", pattern="^(domestic|imported)$")
    is_active: bool = Field(True, description="활성화 여부")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "현대",
                "origin": "domestic",
                "is_active": True
            }
        }


class ManufacturerUpdateRequest(BaseModel):
    """제조사 수정 요청 스키마"""
    name: Optional[str] = Field(None, description="제조사명", min_length=1, max_length=50)
    origin: Optional[str] = Field(None, description="국산/수입", pattern="^(domestic|imported)$")
    is_active: Optional[bool] = Field(None, description="활성화 여부")


class ManufacturerResponse(BaseModel):
    """제조사 응답 스키마"""
    id: UUID
    name: str
    origin: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class ManufacturerListResponse(BaseModel):
    """제조사 목록 응답 스키마"""
    items: List[ManufacturerResponse]
    total: int
    page: int
    limit: int
    total_pages: int

