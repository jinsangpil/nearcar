"""
고객 API 엔드포인트
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.schemas.inspection import (
    InspectionCreateRequest,
    InspectionCreateResponse,
    InspectionDetailResponse
)
from app.schemas.payment import (
    PaymentRequestRequest,
    PaymentRequestResponse,
    PaymentConfirmRequest,
    PaymentConfirmResponse
)
from app.schemas.vehicle import StandardResponse
from app.services.inspection_service import InspectionService
from app.services.payment_service import PaymentService
from app.models.user import User

router = APIRouter(prefix="/client", tags=["고객"])


@router.post("/inspections", response_model=StandardResponse)
async def create_inspection(
    request: InspectionCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    진단 신청 생성 API
    
    고객이 중고차 진단을 신청합니다.
    - 차량 정보, 패키지, 지역, 일정 정보 수신
    - Vehicle 레코드 생성 또는 조회
    - Inspection 레코드 생성 (status: requested)
    """
    try:
        # fuel_type 기본값 설정 (요청에 없으면 gasoline)
        fuel_type = getattr(request, 'fuel_type', 'gasoline')
        
        result = await InspectionService.create_inspection(
            db=db,
            user_id=str(current_user.id),
            vehicle_master_id=request.vehicle_master_id,
            plate_number=request.plate_number,
            production_year=request.year,
            fuel_type=fuel_type,
            location_address=request.location_address,
            region_id=request.region_id,
            preferred_schedule=request.preferred_schedule,
            package_id=request.package_id,
            total_amount=request.total_amount,
            mileage=getattr(request, 'mileage', None)
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
            detail=f"진단 신청 생성 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/inspections/{inspection_id}", response_model=StandardResponse)
async def get_inspection_detail(
    inspection_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    신청 상태 및 레포트 조회 API
    
    본인 신청만 조회 가능합니다.
    - Inspection 상태, 기사 정보, 레포트 정보 포함
    """
    try:
        result = await InspectionService.get_inspection_detail(
            db=db,
            inspection_id=inspection_id,
            user_id=str(current_user.id)
        )
        
        # 권한 검증: 본인 신청만 조회 가능
        from sqlalchemy import select
        from app.models.inspection import Inspection
        
        inspection_result = await db.execute(
            select(Inspection).where(Inspection.id == inspection_id)
        )
        inspection = inspection_result.scalar_one_or_none()
        
        if not inspection:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="진단 신청을 찾을 수 없습니다"
            )
        
        if inspection.user_id != current_user.id and current_user.role not in ["admin", "staff"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="본인 신청만 조회할 수 있습니다"
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
            detail=f"신청 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/vehicle/lookup", response_model=StandardResponse)
async def lookup_vehicle_by_plate(
    plate_number: str = Query(..., description="차량번호"),
    db: AsyncSession = Depends(get_db)
):
    """
    차량번호 조회 API (국토부 API 연동)
    
    국토교통부 API를 통해 차량 정보를 조회합니다.
    현재는 기초 작업만 구현되어 있습니다.
    """
    # TODO: 국토교통부 API 연동 구현
    # 현재는 기본 응답만 반환
    
    return StandardResponse(
        success=True,
        data={
            "plate_number": plate_number,
            "message": "국토교통부 API 연동은 추후 구현 예정입니다"
        },
        error=None
    )


@router.post("/payments/request", response_model=StandardResponse)
async def request_payment(
    request: PaymentRequestRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    결제 요청 API (KCP)
    
    진단 신청에 대한 결제를 요청합니다.
    - 서버에서 최종 금액 재계산 및 검증
    - KCP 거래등록 API 호출
    - 결제창 호출을 위한 정보 반환
    """
    try:
        payment_service = PaymentService()
        result = await payment_service.request_payment(
            db=db,
            inspection_id=request.inspection_id,
            amount=request.amount,
            customer_info=request.customer_info
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
            detail=f"결제 요청 중 오류가 발생했습니다: {str(e)}"
        )


@router.post("/payments/confirm", response_model=StandardResponse)
async def confirm_payment(
    request: PaymentConfirmRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    결제 확인 API (KCP)
    
    KCP 결제창에서 결제 완료 후 호출됩니다.
    - 결제 정보 검증
    - Payment 레코드 업데이트
    - Inspection 상태 업데이트
    """
    try:
        payment_service = PaymentService()
        result = await payment_service.confirm_payment(
            db=db,
            order_id=request.order_id,
            tno=request.tno,
            res_cd=request.res_cd,
            res_msg=request.res_msg,
            amount=request.amount
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
            detail=f"결제 확인 중 오류가 발생했습니다: {str(e)}"
        )

