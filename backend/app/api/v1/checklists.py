"""
체크리스트 API 엔드포인트
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.schemas.checklist import (
    ChecklistTemplateResponse,
    ChecklistSaveRequest,
    ChecklistResponse
)
from app.schemas.vehicle import StandardResponse
from app.services.checklist_service import ChecklistService
from app.models.user import User

router = APIRouter(prefix="/checklists", tags=["체크리스트"])


@router.get("/templates", response_model=StandardResponse)
async def get_checklist_templates(
    db: AsyncSession = Depends(get_db)
):
    """
    체크리스트 템플릿 조회 API
    
    섹션별 체크리스트 템플릿을 반환합니다.
    """
    templates = ChecklistService.get_templates()
    
    return StandardResponse(
        success=True,
        data=templates,
        error=None
    )


@router.post("/inspections/{inspection_id}/checklist", response_model=StandardResponse)
async def save_checklist(
    inspection_id: str,
    request: ChecklistSaveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["inspector"]))
):
    """
    체크리스트 저장 API
    
    기사가 진단 체크리스트를 저장합니다.
    - InspectionReport 레코드 생성/업데이트
    - checklist_data JSONB 필드에 저장
    """
    try:
        result = await ChecklistService.save_checklist(
            db=db,
            inspection_id=inspection_id,
            checklist_data=request.checklist_data,
            images=request.images,
            inspector_comment=request.inspector_comment,
            repair_cost_est=request.repair_cost_est
        )
        
        return StandardResponse(
            success=True,
            data=result,
            error=None
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"체크리스트 저장 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/inspections/{inspection_id}/checklist", response_model=StandardResponse)
async def get_checklist(
    inspection_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    체크리스트 조회 API
    
    저장된 체크리스트를 조회합니다.
    """
    try:
        checklist = await ChecklistService.get_checklist(
            db=db,
            inspection_id=inspection_id
        )
        
        if not checklist:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="체크리스트를 찾을 수 없습니다"
            )
        
        return StandardResponse(
            success=True,
            data=checklist,
            error=None
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"체크리스트 조회 중 오류가 발생했습니다: {str(e)}"
        )

