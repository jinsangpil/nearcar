"""
견적 산출 API 엔드포인트
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.quote import (
    QuoteCalculateRequest,
    QuoteCalculateResponse
)
from app.schemas.vehicle import StandardResponse
from app.services.pricing_service import PricingService

router = APIRouter(prefix="/quotes", tags=["견적"])


@router.post("/calculate", response_model=StandardResponse)
async def calculate_quote(
    request: QuoteCalculateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    견적 계산 API
    
    차량 정보, 패키지, 지역을 기반으로 진단 견적을 계산합니다.
    - 기본 패키지 가격
    - 차량 등급별 할증
    - 지역별 출장비
    - 총액 (10원 단위 반올림)
    
    Redis 캐싱 적용 (TTL: 10분)
    """
    try:
        result = await PricingService.calculate_quote(
            db=db,
            vehicle_master_id=request.vehicle_master_id,
            package_id=request.package_id,
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
            detail=f"견적 계산 중 오류가 발생했습니다: {str(e)}"
        )

