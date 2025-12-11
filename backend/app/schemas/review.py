from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid

class ReviewBase(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="별점 (1-5)")
    content: Optional[str] = Field(None, description="리뷰 내용")
    photos: Optional[List[str]] = Field(None, description="사진 URL 목록")
    is_hidden: bool = Field(False, description="숨김 여부")

class ReviewCreateRequest(BaseModel):
    inspection_id: str = Field(..., description="진단 ID")
    rating: int = Field(..., ge=1, le=5, description="별점 (1-5)")
    content: Optional[str] = Field(None, description="리뷰 내용")
    photos: Optional[List[str]] = Field(None, description="사진 URL 목록")

class ReviewUpdateRequest(BaseModel):
    is_hidden: Optional[bool] = Field(None, description="숨김 여부")

class ReviewResponse(ReviewBase):
    id: uuid.UUID
    user_id: uuid.UUID
    inspection_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    user_name: Optional[str] = Field(None, description="작성자 이름 (조회 시 포함)")

    class Config:
        from_attributes = True

class ReviewListResponse(BaseModel):
    items: List[ReviewResponse]
    total: int
    page: int
    limit: int
    total_pages: int
