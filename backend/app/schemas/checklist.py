"""
체크리스트 관련 스키마
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class ChecklistTemplateResponse(BaseModel):
    """체크리스트 템플릿 응답 스키마"""
    section: str = Field(..., description="섹션명")
    items: List[Dict[str, Any]] = Field(..., description="체크 항목 목록")
    
    class Config:
        json_schema_extra = {
            "example": {
                "section": "외관",
                "items": [
                    {"id": "front_bumper", "name": "앞 범퍼", "type": "checkbox"},
                    {"id": "rear_bumper", "name": "뒤 범퍼", "type": "checkbox"}
                ]
            }
        }


class ChecklistItem(BaseModel):
    """체크리스트 항목 스키마"""
    item_id: str = Field(..., description="항목 ID")
    status: str = Field(..., description="상태 (normal, warning, defect)")
    note: Optional[str] = Field(None, description="특이사항")


class ChecklistSaveRequest(BaseModel):
    """체크리스트 저장 요청 스키마"""
    checklist_data: Dict[str, Any] = Field(..., description="체크리스트 데이터")
    images: Optional[List[Dict[str, Any]]] = Field(default=[], description="이미지 URL 리스트")
    inspector_comment: Optional[str] = Field(None, description="종합 의견")
    repair_cost_est: Optional[int] = Field(None, description="예상 수리비", ge=0)
    
    class Config:
        json_schema_extra = {
            "example": {
                "checklist_data": {
                    "engine_oil": "leak",
                    "tire_wear": "normal"
                },
                "images": [
                    {"section": "front", "url": "https://s3.../img1.jpg"},
                    {"section": "engine", "url": "https://s3.../img2.jpg"}
                ],
                "inspector_comment": "엔진 오일 누유가 미세하게 있어 수리 요망",
                "repair_cost_estimate": 150000
            }
        }


class ChecklistResponse(BaseModel):
    """체크리스트 조회 응답 스키마"""
    inspection_id: str
    checklist_data: Dict[str, Any]
    images: List[Dict[str, Any]]
    inspector_comment: Optional[str]
    repair_cost_est: Optional[int]
    status: str
    created_at: str
    
    class Config:
        from_attributes = True

