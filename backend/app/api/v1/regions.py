"""
서비스 지역 조회 API 엔드포인트
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.vehicle import StandardResponse
from app.services.pricing_service import PricingService

router = APIRouter(prefix="/regions", tags=["서비스 지역"])


@router.get("", response_model=StandardResponse)
async def get_regions(
    db: AsyncSession = Depends(get_db)
):
    """
    서비스 지역 목록 조회 API
    
    계층형 구조로 서비스 지역 목록을 조회합니다.
    - 시/도별로 그룹화
    - 각 시/도 하위에 시/구/군 목록 포함
    
    Redis 캐싱 적용 (TTL: 1시간)
    """
    regions = await PricingService.get_regions(db)
    
    return StandardResponse(
        success=True,
        data=regions,
        error=None
    )

