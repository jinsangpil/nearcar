"""
공공데이터포털 API 프록시 엔드포인트
VWorld API를 통한 행정구역 정보 조회
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any

from app.core.database import get_db
from app.schemas.vehicle import StandardResponse
from app.services.public_data_service import PublicDataService

router = APIRouter(prefix="/public-data", tags=["공공데이터"])


@router.get("/provinces", response_model=StandardResponse)
async def get_provinces():
    """
    광역시도 목록 조회 API
    
    고정된 광역시도 목록을 반환합니다.
    """
    try:
        provinces = await PublicDataService.get_all_provinces()
        return StandardResponse(
            success=True,
            data=provinces,
            error=None
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"광역시도 목록 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/cities", response_model=StandardResponse)
async def get_cities(
    province_code: str = Query(..., description="광역시도 코드 (11, 21, 22 등)")
):
    """
    시군구 목록 조회 API
    
    광역시도 코드로 해당 지역의 시군구 목록을 조회합니다.
    VWorld API를 통해 조회합니다.
    """
    try:
        cities = await PublicDataService.get_cities_by_province(province_code)
        return StandardResponse(
            success=True,
            data=cities,
            error=None
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"시군구 목록 조회 중 오류가 발생했습니다: {str(e)}"
        )

