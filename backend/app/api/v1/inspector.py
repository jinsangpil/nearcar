"""
기사 API 엔드포인트
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.database import get_db
from app.core.dependencies import require_role
from app.schemas.inspection import (
    AssignmentResponse,
    AssignmentAcceptRequest,
    AssignmentRejectRequest,
    InspectionStatusUpdateRequest
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


@router.get("/my-inspections", response_model=StandardResponse)
async def get_my_inspections(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["inspector"]))
):
    """
    진행 중인 작업 목록 조회 API
    
    기사 본인이 수락한 작업 목록을 조회합니다.
    - 상태 필터링 지원 (assigned, scheduled, in_progress, report_submitted)
    """
    try:
        inspections = await InspectionService.get_my_inspections(
            db=db,
            inspector_id=str(current_user.id),
            status=status
        )
        
        return StandardResponse(
            success=True,
            data=inspections,
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
            detail=f"작업 목록 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/dashboard/stats", response_model=StandardResponse)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["inspector"]))
):
    """
    기사 대시보드 통계 조회 API
    
    오늘의 일정, 신규 배정 요청, 진행 중인 작업 수 등을 조회합니다.
    """
    try:
        stats = await InspectionService.get_inspector_dashboard_stats(
            db=db,
            inspector_id=str(current_user.id)
        )
        
        return StandardResponse(
            success=True,
            data=stats,
            error=None
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"대시보드 통계 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.patch("/inspections/{inspection_id}/status", response_model=StandardResponse)
async def update_inspection_status(
    inspection_id: str,
    request: InspectionStatusUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["inspector"]))
):
    """
    작업 상태 변경 API
    
    기사가 본인의 작업 상태를 변경합니다.
    - assigned -> scheduled (일정 확정)
    - scheduled -> in_progress (진단 시작)
    - in_progress -> report_submitted (레포트 제출)
    """
    try:
        result = await InspectionService.update_inspection_status_by_inspector(
            db=db,
            inspection_id=inspection_id,
            inspector_id=str(current_user.id),
            new_status=request.new_status
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
            detail=f"상태 변경 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/inspections/{inspection_id}", response_model=StandardResponse)
async def get_inspection_detail(
    inspection_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["inspector"]))
):
    """
    작업 상세 정보 조회 API
    
    기사가 본인의 작업 상세 정보를 조회합니다.
    """
    try:
        # Inspection 조회 및 본인 작업인지 확인
        from app.models.inspection import Inspection
        from sqlalchemy import select
        
        result = await db.execute(
            select(Inspection).where(Inspection.id == inspection_id)
        )
        inspection = result.scalar_one_or_none()
        
        if not inspection:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="진단 신청을 찾을 수 없습니다"
            )
        
        # 본인의 작업인지 확인
        if str(inspection.inspector_id) != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="본인의 작업만 조회할 수 있습니다"
            )
        
        # InspectionService의 get_inspection_detail 사용
        inspection_detail = await InspectionService.get_inspection_detail(
            db=db,
            inspection_id=inspection_id,
            user_id=str(inspection.user_id)
        )
        
        return StandardResponse(
            success=True,
            data=inspection_detail,
            error=None
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"작업 상세 정보 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/settlements", response_model=StandardResponse)
async def get_my_settlements(
    status: Optional[str] = Query(None, description="정산 상태 (pending, completed)"),
    start_date: Optional[str] = Query(None, description="시작일 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="종료일 (YYYY-MM-DD)"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    page_size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["inspector"]))
):
    """
    기사 본인의 정산 내역 조회 API
    
    기사가 자신의 정산 내역을 조회합니다.
    """
    try:
        from app.services.settlement_service import SettlementService
        from datetime import date as date_type
        
        # 날짜 문자열을 date 객체로 변환
        start_date_obj = None
        end_date_obj = None
        if start_date:
            start_date_obj = date_type.fromisoformat(start_date)
        if end_date:
            end_date_obj = date_type.fromisoformat(end_date)
        
        result = await SettlementService.get_settlements(
            db=db,
            inspector_id=str(current_user.id),
            status=status,
            start_date=start_date_obj,
            end_date=end_date_obj,
            page=page,
            page_size=page_size
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
            detail=f"정산 내역 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/settlements/{settlement_id}", response_model=StandardResponse)
async def get_settlement_detail(
    settlement_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["inspector"]))
):
    """
    정산 상세 내역 조회 API
    
    기사가 본인의 정산 상세 내역을 조회합니다.
    """
    try:
        from app.services.settlement_service import SettlementService
        
        result = await SettlementService.get_settlement_detail(
            db=db,
            settlement_id=settlement_id
        )
        
        # 본인의 정산인지 확인
        if result.get("inspector_id") != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="본인의 정산 내역만 조회할 수 있습니다"
            )
        
        return StandardResponse(
            success=True,
            data=result,
            error=None
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"정산 상세 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/settlements/summary/monthly", response_model=StandardResponse)
async def get_monthly_settlement_summary(
    year: Optional[int] = Query(None, description="연도 (기본값: 현재 연도)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["inspector"]))
):
    """
    월별 정산 요약 조회 API
    
    기사 본인의 월별 정산 금액 추이를 조회합니다.
    """
    try:
        from app.services.settlement_service import SettlementService
        from datetime import date, datetime, timedelta
        
        if not year:
            year = datetime.now().year
        
        # 해당 연도의 시작일과 종료일
        start_date = date(year, 1, 1)
        end_date = date(year, 12, 31)
        
        # 월별 집계
        monthly_summary = []
        for month in range(1, 13):
            month_start = date(year, month, 1)
            if month == 12:
                month_end = date(year, 12, 31)
            else:
                month_end = date(year, month + 1, 1) - timedelta(days=1)
            
            result = await SettlementService.get_settlements(
                db=db,
                inspector_id=str(current_user.id),
                start_date=month_start,
                end_date=month_end,
                page=1,
                page_size=1000  # 월별 데이터는 모두 가져옴
            )
            
            settlements = result.get("settlements", [])
            total_amount = sum(s.get("settle_amount", 0) for s in settlements)
            count = len(settlements)
            
            monthly_summary.append({
                "month": month,
                "year": year,
                "total_amount": total_amount,
                "count": count,
            })
        
        return StandardResponse(
            success=True,
            data={
                "year": year,
                "monthly_summary": monthly_summary,
            },
            error=None
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"월별 정산 요약 조회 중 오류가 발생했습니다: {str(e)}"
        )

