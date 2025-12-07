"""
결제 관련 API 엔드포인트
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import select

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.schemas.payment import (
    PaymentRequestRequest,
    PaymentRequestResponse,
    PaymentConfirmRequest,
    PaymentConfirmResponse,
    PaymentStatusResponse,
    PaymentCancelRequest,
    PaymentCancelResponse
)
from app.schemas.vehicle import StandardResponse
from app.services.payment_service import PaymentService
from app.models.user import User
from app.models.inspection import Inspection

router = APIRouter(prefix="/payments", tags=["결제"])


@router.post("/request", response_model=StandardResponse)
async def request_payment(
    request: PaymentRequestRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    결제 요청 API
    
    진단 신청에 대한 결제를 요청합니다.
    - 서버에서 최종 금액 재계산 및 검증
    - 토스페이먼츠 결제 요청 생성
    - 결제창 띄우기 위한 정보 반환
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


@router.post("/confirm", response_model=StandardResponse)
async def confirm_payment(
    request: PaymentConfirmRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    결제 승인 API
    
    토스페이먼츠 결제창에서 결제 완료 후 호출됩니다.
    - 결제 정보 검증
    - Payment 레코드 업데이트
    - Inspection 상태 업데이트
    """
    try:
        payment_service = PaymentService()
        result = await payment_service.confirm_payment(
            db=db,
            payment_key=request.payment_key,
            order_id=request.order_id,
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
            detail=f"결제 승인 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/{payment_id}", response_model=StandardResponse)
async def get_payment_status(
    payment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    결제 상태 조회 API
    
    결제 정보를 조회합니다.
    """
    try:
        payment_service = PaymentService()
        payment = await payment_service.get_payment(db, payment_id)
        
        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="결제 정보를 찾을 수 없습니다"
            )
        
        # 권한 확인: 본인 또는 관리자만 조회 가능
        if current_user.role not in ["admin", "staff"]:
            # Inspection을 통해 user_id 확인 필요
            inspection_result = await db.execute(
                select(Inspection).where(Inspection.id == payment.inspection_id)
            )
            inspection = inspection_result.scalar_one_or_none()
            
            if not inspection or inspection.user_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="결제 정보 조회 권한이 없습니다"
                )
        
        payment_data = {
            "payment_id": str(payment.id),
            "inspection_id": str(payment.inspection_id),
            "amount": payment.amount,
            "method": payment.method,
            "pg_provider": payment.pg_provider,
            "transaction_id": payment.transaction_id,
            "status": payment.status,
            "paid_at": payment.paid_at.isoformat() if payment.paid_at else None,
            "created_at": payment.created_at.isoformat(),
            "updated_at": payment.updated_at.isoformat()
        }
        
        return StandardResponse(
            success=True,
            data=payment_data,
            error=None
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"결제 상태 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.post("/{payment_id}/cancel", response_model=StandardResponse)
async def cancel_payment(
    payment_id: str,
    request: PaymentCancelRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    결제 취소 API
    
    관리자 전용 결제 취소 기능입니다.
    - 전체 취소 또는 부분 취소 지원
    - 토스페이먼츠 취소 API 호출
    - Payment 레코드 업데이트
    """
    try:
        payment_service = PaymentService()
        result = await payment_service.cancel_payment(
            db=db,
            payment_id=payment_id,
            cancel_reason=request.cancel_reason,
            cancel_amount=request.cancel_amount
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
            detail=f"결제 취소 중 오류가 발생했습니다: {str(e)}"
        )

