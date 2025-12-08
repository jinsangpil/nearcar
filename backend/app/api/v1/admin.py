"""
운영자 API 엔드포인트
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.database import get_db
from app.core.dependencies import require_role, require_admin_only, require_admin_or_staff
from app.schemas.admin import (
    VehicleMasterCreateRequest,
    PricePolicyCreateRequest,
    InspectionAssignRequest,
    SettlementCalculateRequest
)
from app.schemas.user import (
    UserCreateRequest,
    UserUpdateRequest,
    UserResponse,
    UserListResponse,
    UserLevelUpdateRequest,
    UserCommissionUpdateRequest,
    UserRegionUpdateRequest,
    UserRoleUpdateRequest,
    UserStatusUpdateRequest
)
from app.schemas.vehicle import StandardResponse
from app.services.admin_service import AdminService
from app.services.user_service import UserService
from app.models.user import User

router = APIRouter(prefix="/admin", tags=["운영자"])


@router.get("/dashboard/stats", response_model=StandardResponse)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    대시보드 통계 API
    
    주요 지표 및 추이 데이터를 반환합니다.
    관리자 권한 필요.
    """
    try:
        result = await AdminService.get_dashboard_stats(db=db)
        
        return StandardResponse(
            success=True,
            data=result,
            error=None
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"대시보드 통계 조회 중 오류가 발생했습니다: {str(e)}"
        )


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


@router.get("/inspections/{inspection_id}", response_model=StandardResponse)
async def get_inspection_detail(
    inspection_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    신청 상세 조회 API (관리자용)
    
    관리자가 신청 상세 정보를 조회합니다.
    관리자 권한 필요.
    """
    try:
        from app.services.inspection_service import InspectionService
        
        # Inspection 조회
        from app.models.inspection import Inspection
        from sqlalchemy import select
        
        inspection_result = await db.execute(
            select(Inspection).where(Inspection.id == inspection_id)
        )
        inspection = inspection_result.scalar_one_or_none()
        
        if not inspection:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="진단 신청을 찾을 수 없습니다"
            )
        
        # 관리자용 상세 정보 조회 (user_id는 inspection의 user_id 사용)
        result = await InspectionService.get_inspection_detail(
            db=db,
            inspection_id=inspection_id,
            user_id=str(inspection.user_id)
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
            detail=f"신청 상세 조회 중 오류가 발생했습니다: {str(e)}"
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


@router.patch("/inspections/{inspection_id}/status", response_model=StandardResponse)
async def update_inspection_status(
    inspection_id: str,
    status: str = Query(..., description="새 상태"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    신청 상태 변경 API
    
    관리자가 신청 상태를 변경합니다.
    관리자 권한 필요.
    """
    try:
        from app.models.inspection import Inspection
        from sqlalchemy import select
        
        # Inspection 조회
        result = await db.execute(
            select(Inspection).where(Inspection.id == inspection_id)
        )
        inspection = result.scalar_one_or_none()
        
        if not inspection:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="진단 신청을 찾을 수 없습니다"
            )
        
        # 유효한 상태인지 확인
        valid_statuses = ["requested", "paid", "assigned", "in_progress", "completed", "sent", "cancelled"]
        if status not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"유효하지 않은 상태입니다: {status}"
            )
        
        # 상태 변경
        inspection.status = status
        await db.commit()
        await db.refresh(inspection)
        
        return StandardResponse(
            success=True,
            data={
                "inspection_id": str(inspection.id),
                "status": inspection.status
            },
            error=None
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"상태 변경 중 오류가 발생했습니다: {str(e)}"
        )


@router.post("/reports/{inspection_id}/approve", response_model=StandardResponse)
async def approve_report(
    inspection_id: str,
    feedback: Optional[str] = Query(None, description="피드백"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    레포트 승인 API
    
    관리자가 제출된 레포트를 승인합니다.
    관리자 권한 필요.
    """
    try:
        from app.models.inspection import Inspection
        from app.models.inspection_report import InspectionReport
        from sqlalchemy import select
        
        # Inspection 조회
        result = await db.execute(
            select(Inspection).where(Inspection.id == inspection_id)
        )
        inspection = result.scalar_one_or_none()
        
        if not inspection:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="진단 신청을 찾을 수 없습니다"
            )
        
        # InspectionReport 조회
        report_result = await db.execute(
            select(InspectionReport).where(InspectionReport.inspection_id == inspection_id)
        )
        report = report_result.scalar_one_or_none()
        
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="레포트를 찾을 수 없습니다"
            )
        
        # 레포트 상태를 승인으로 변경
        report.status = "approved"
        inspection.status = "sent"  # Inspection 상태도 발송완료로 변경
        
        await db.commit()
        await db.refresh(report)
        await db.refresh(inspection)
        
        # 알림 트리거 (고객에게 레포트 발송 알림)
        from app.services.notification_trigger_service import NotificationTriggerService
        await NotificationTriggerService.trigger_report_approved(
            db=db,
            inspection_id=inspection_id,
            user_id=str(inspection.user_id)
        )
        
        return StandardResponse(
            success=True,
            data={
                "inspection_id": str(inspection.id),
                "report_id": str(report.id),
                "status": "approved"
            },
            error=None
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"레포트 승인 중 오류가 발생했습니다: {str(e)}"
        )


@router.post("/reports/{inspection_id}/reject", response_model=StandardResponse)
async def reject_report(
    inspection_id: str,
    feedback: Optional[str] = Query(None, description="반려 사유"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    레포트 반려 API
    
    관리자가 제출된 레포트를 반려합니다.
    관리자 권한 필요.
    """
    try:
        from app.models.inspection import Inspection
        from app.models.inspection_report import InspectionReport
        from sqlalchemy import select
        
        # Inspection 조회
        result = await db.execute(
            select(Inspection).where(Inspection.id == inspection_id)
        )
        inspection = result.scalar_one_or_none()
        
        if not inspection:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="진단 신청을 찾을 수 없습니다"
            )
        
        # InspectionReport 조회
        report_result = await db.execute(
            select(InspectionReport).where(InspectionReport.inspection_id == inspection_id)
        )
        report = report_result.scalar_one_or_none()
        
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="레포트를 찾을 수 없습니다"
            )
        
        # 레포트 상태를 반려로 변경
        report.status = "rejected"
        if feedback:
            # 피드백을 inspector_comment에 추가하거나 별도 필드에 저장
            # 현재는 간단히 상태만 변경
            pass
        
        await db.commit()
        await db.refresh(report)
        
        # 알림 트리거 (기사에게 수정 요청 알림)
        if inspection.inspector_id:
            from app.services.notification_trigger_service import NotificationTriggerService
            await NotificationTriggerService.trigger_report_rejected(
                db=db,
                inspection_id=inspection_id,
                inspector_id=str(inspection.inspector_id),
                feedback=feedback or ""
            )
        
        return StandardResponse(
            success=True,
            data={
                "inspection_id": str(inspection.id),
                "report_id": str(report.id),
                "status": "rejected"
            },
            error=None
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"레포트 반려 중 오류가 발생했습니다: {str(e)}"
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


# ==================== 유저 관리 API ====================

@router.post("/users", response_model=StandardResponse)
async def create_user(
    request: UserCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"], require_admin_for_admin_role=True))
):
    """
    유저 생성 API
    
    관리자가 새 유저를 생성합니다.
    관리자/직원 권한 필요.
    """
    try:
        result = await UserService.create_user(
            db=db,
            role=request.role,
            name=request.name,
            phone=request.phone,
            email=request.email,
            password=request.password,
            region_id=request.region_id,
            level=request.level,
            commission_rate=float(request.commission_rate) if request.commission_rate else None,
            status=request.status
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
            detail=f"유저 생성 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/users/{user_id}", response_model=StandardResponse)
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    유저 상세 조회 API
    
    관리자가 유저 상세 정보를 조회합니다.
    관리자/직원 권한 필요.
    """
    try:
        result = await UserService.get_user(db=db, user_id=user_id)
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="유저를 찾을 수 없습니다"
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
            detail=f"유저 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.patch("/users/{user_id}", response_model=StandardResponse)
async def update_user(
    user_id: str,
    request: UserUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    유저 정보 수정 API
    
    관리자가 유저 정보를 수정합니다.
    관리자/직원 권한 필요.
    """
    try:
        result = await UserService.update_user(
            db=db,
            user_id=user_id,
            name=request.name,
            email=request.email,
            phone=request.phone,
            password=request.password,
            region_id=request.region_id,
            level=request.level,
            commission_rate=float(request.commission_rate) if request.commission_rate else None,
            status=request.status
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
            detail=f"유저 수정 중 오류가 발생했습니다: {str(e)}"
        )


@router.delete("/users/{user_id}", response_model=StandardResponse)
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    유저 삭제 API (Soft Delete)
    
    관리자가 유저를 삭제합니다. 실제로는 상태를 inactive로 변경합니다.
    관리자/직원 권한 필요.
    """
    try:
        result = await UserService.delete_user(db=db, user_id=user_id)
        
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
            detail=f"유저 삭제 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/users", response_model=StandardResponse)
async def list_users(
    role: Optional[str] = Query(None, description="역할 필터"),
    status: Optional[str] = Query(None, description="상태 필터"),
    level: Optional[int] = Query(None, description="등급 필터 (기사용)"),
    search: Optional[str] = Query(None, description="검색어 (이름, 이메일)"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    limit: int = Query(20, ge=1, le=100, description="페이지 크기"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    유저 목록 조회 API
    
    필터링, 검색, 페이지네이션을 지원합니다.
    관리자/직원 권한 필요.
    """
    try:
        offset = (page - 1) * limit
        
        result = await UserService.list_users(
            db=db,
            role=role,
            status=status,
            level=level,
            search=search,
            offset=offset,
            limit=limit
        )
        
        return StandardResponse(
            success=True,
            data=result,
            error=None
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"유저 목록 조회 중 오류가 발생했습니다: {str(e)}"
        )


# ==================== 유저 등급/역할/상태 관리 API ====================

@router.patch("/users/{user_id}/level", response_model=StandardResponse)
async def update_user_level(
    user_id: str,
    request: UserLevelUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    기사 등급 변경 API
    
    기사의 등급을 변경합니다 (1~5).
    관리자/직원 권한 필요.
    """
    try:
        result = await UserService.update_user_level(
            db=db,
            user_id=user_id,
            level=request.level
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
            detail=f"등급 변경 중 오류가 발생했습니다: {str(e)}"
        )


@router.patch("/users/{user_id}/commission", response_model=StandardResponse)
async def update_user_commission(
    user_id: str,
    request: UserCommissionUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    수수료율 변경 API
    
    기사의 수수료율을 변경합니다 (0~100%).
    관리자/직원 권한 필요.
    """
    try:
        result = await UserService.update_user_commission(
            db=db,
            user_id=user_id,
            commission_rate=float(request.commission_rate)
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
            detail=f"수수료율 변경 중 오류가 발생했습니다: {str(e)}"
        )


@router.patch("/users/{user_id}/region", response_model=StandardResponse)
async def update_user_region(
    user_id: str,
    request: UserRegionUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    활동 지역 변경 API
    
    기사의 활동 지역을 변경합니다.
    관리자/직원 권한 필요.
    """
    try:
        result = await UserService.update_user_region(
            db=db,
            user_id=user_id,
            region_id=request.region_id
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
            detail=f"활동 지역 변경 중 오류가 발생했습니다: {str(e)}"
        )


@router.patch("/users/{user_id}/role", response_model=StandardResponse)
async def update_user_role(
    user_id: str,
    request: UserRoleUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_only())
):
    """
    역할 변경 API
    
    유저의 역할을 변경합니다.
    - admin 역할 부여는 admin만 가능
    - 자기 자신의 역할 변경 불가
    관리자 권한 필요.
    """
    try:
        result = await UserService.update_user_role(
            db=db,
            user_id=user_id,
            new_role=request.role,
            current_user_id=str(current_user.id)
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
            detail=f"역할 변경 중 오류가 발생했습니다: {str(e)}"
        )


@router.patch("/users/{user_id}/status", response_model=StandardResponse)
async def update_user_status(
    user_id: str,
    request: UserStatusUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    계정 상태 변경 API
    
    유저의 계정 상태를 변경합니다 (active/inactive/suspended).
    관리자/직원 권한 필요.
    """
    try:
        result = await UserService.update_user_status(
            db=db,
            user_id=user_id,
            new_status=request.status
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

