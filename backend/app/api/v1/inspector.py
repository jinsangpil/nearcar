"""
기사 API 엔드포인트
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_role
from app.schemas.inspection import (
    AssignmentResponse,
    AssignmentAcceptRequest,
    AssignmentRejectRequest
)
from app.schemas.vehicle import StandardResponse
from app.services.inspection_service import InspectionService
from app.models.user import User

router = APIRouter(prefix="/inspector", tags=["기사"])


@router.get("/assignments", response_model=StandardResponse)
async def get_assignments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["inspector"]))
):
    """
    배정 대기 목록 조회 API
    
    기사 본인의 활동 지역 기반으로 배정 대기 목록을 조회합니다.
    - 상태가 'requested' 또는 'assigned'인 신청만 조회
    """
    try:
        assignments = await InspectionService.get_assignments_for_inspector(
            db=db,
            inspector_id=str(current_user.id)
        )
        
        return StandardResponse(
            success=True,
            data=assignments,
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
            detail=f"배정 목록 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.post("/assignments/{inspection_id}/accept", response_model=StandardResponse)
async def accept_assignment(
    inspection_id: str,
    request: AssignmentAcceptRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["inspector"]))
):
    """
    배정 수락 API
    
    기사가 배정 요청을 수락합니다.
    - Inspection 상태를 'assigned'로 변경
    - inspector_id 업데이트
    """
    try:
        result = await InspectionService.accept_assignment(
            db=db,
            inspection_id=inspection_id,
            inspector_id=str(current_user.id)
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
            detail=f"배정 수락 중 오류가 발생했습니다: {str(e)}"
        )


@router.post("/assignments/{inspection_id}/reject", response_model=StandardResponse)
async def reject_assignment(
    inspection_id: str,
    request: AssignmentRejectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["inspector"]))
):
    """
    배정 거절 API
    
    기사가 배정 요청을 거절합니다.
    - 거절 사유 저장
    - Inspection 상태는 'requested'로 유지 (다른 기사 배정 가능)
    """
    try:
        result = await InspectionService.reject_assignment(
            db=db,
            inspection_id=inspection_id,
            inspector_id=str(current_user.id),
            reason=request.reason
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
            detail=f"배정 거절 중 오류가 발생했습니다: {str(e)}"
        )

