"""
패키지 조회 API 엔드포인트
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.vehicle import StandardResponse
from app.services.pricing_service import PricingService

router = APIRouter(prefix="/packages", tags=["패키지"])


@router.get("", response_model=StandardResponse)
async def get_packages(
    db: AsyncSession = Depends(get_db)
):
    """
    패키지 목록 조회 API
    
    활성화된 진단 패키지 목록을 조회합니다.
    Redis 캐싱 적용 (TTL: 1시간)
    """
    packages = await PricingService.get_packages(db)
    
    return StandardResponse(
        success=True,
        data=packages,
        error=None
    )

