from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid

class FAQBase(BaseModel):
    category: str = Field(..., description="카테고리 (payment, refund, etc)")
    question: str = Field(..., description="질문")
    answer: str = Field(..., description="답변")
    is_active: bool = Field(True, description="활성화 여부")
    display_order: int = Field(0, description="표시 순서")

class FAQCreateRequest(FAQBase):
    pass

class FAQUpdateRequest(BaseModel):
    category: Optional[str] = None
    question: Optional[str] = None
    answer: Optional[str] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None

class FAQResponse(FAQBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class FAQListResponse(BaseModel):
    items: List[FAQResponse]
    total: int
