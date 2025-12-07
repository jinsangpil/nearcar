"""
운영자 API 엔드포인트
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.database import get_db
from app.core.dependencies import require_role
from app.schemas.admin import (
    VehicleMasterCreateRequest,
    PricePolicyCreateRequest,
    InspectionAssignRequest,
    SettlementCalculateRequest
)
from app.schemas.vehicle import StandardResponse
from app.services.admin_service import AdminService
from app.models.user import User

router = APIRouter(prefix="/admin", tags=["운영자"])


@router.post("/vehicles/master", response_model=StandardResponse)
async def create_or_update_vehicle_master(
    request: VehicleMasterCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    차량 마스터 데이터 관리 API
    
    차량 마스터 데이터를 생성하거나 업데이트합니다.
    관리자 권한 필요.
    """
    try:
        result = await AdminService.create_or_update_vehicle_master(
            db=db,
            origin=request.origin,
            manufacturer=request.manufacturer,
            model_group=request.model_group,
            model_detail=request.model_detail,
            vehicle_class=request.vehicle_class,
            start_year=request.start_year,
            end_year=request.end_year
        )
        
        return StandardResponse(
            success=True,
            data=result,
            error=None
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"차량 마스터 데이터 관리 중 오류가 발생했습니다: {str(e)}"
        )


@router.post("/prices", response_model=StandardResponse)
async def create_or_update_price_policy(
    request: PricePolicyCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    가격 정책 설정 API
    
    차량 등급별 추가 요금 정책을 생성하거나 업데이트합니다.
    Redis 캐시가 자동으로 무효화됩니다.
    """
    try:
        result = await AdminService.create_or_update_price_policy(
            db=db,
            origin=request.origin,
            vehicle_class=request.vehicle_class,
            add_amount=request.add_amount
        )
        
        return StandardResponse(
            success=True,
            data=result,
            error=None
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"가격 정책 설정 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/inspections", response_model=StandardResponse)
async def get_inspections(
    status: Optional[str] = Query(None, description="상태 필터"),
    region: Optional[str] = Query(None, description="지역 필터"),
    date: Optional[str] = Query(None, description="날짜 필터 (YYYY-MM-DD)"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    limit: int = Query(20, ge=1, le=100, description="페이지 크기"),
    sort_by: str = Query("created_at", description="정렬 기준"),
    sort_order: str = Query("desc", description="정렬 순서"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    신청 목록 조회 API
    
    필터링, 정렬, 페이지네이션을 지원합니다.
    관리자 권한 필요.
    """
    try:
        from datetime import datetime as dt
        
        target_date = None
        if date:
            try:
                target_date = dt.strptime(date, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)"
                )
        
        result = await AdminService.get_inspections(
            db=db,
            status=status,
            region=region,
            target_date=target_date,
            page=page,
            limit=limit,
            sort_by=sort_by,
            sort_order=sort_order
        )
        
        return StandardResponse(
            success=True,
            data=result,
            error=None
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"신청 목록 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.post("/inspections/{inspection_id}/assign", response_model=StandardResponse)
async def assign_inspector(
    inspection_id: str,
    request: InspectionAssignRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    강제 배정 API
    
    관리자가 직접 기사를 배정합니다.
    Inspection 상태를 'assigned'로 변경합니다.
    """
    try:
        result = await AdminService.assign_inspector(
            db=db,
            inspection_id=inspection_id,
            inspector_id=request.inspector_id
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
            detail=f"기사 배정 중 오류가 발생했습니다: {str(e)}"
        )


@router.post("/settlements/calculate", response_model=StandardResponse)
async def calculate_settlements(
    request: SettlementCalculateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    정산 집계 API
    
    특정 날짜 완료 건에 대한 정산을 계산하고 Settlement 레코드를 생성합니다.
    관리자 권한 필요.
    """
    try:
        result = await AdminService.calculate_settlements(
            db=db,
            target_date=request.target_date
        )
        
        return StandardResponse(
            success=True,
            data=result,
            error=None
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"정산 집계 중 오류가 발생했습니다: {str(e)}"
        )

