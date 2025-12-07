"""
차량 마스터 조회 API 엔드포인트
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.database import get_db
from app.schemas.vehicle import (
    StandardResponse,
    ManufacturerResponse,
    ModelGroupResponse,
    VehicleModelDetailResponse,
    VehicleClassResponse
)
from app.services.vehicle_service import VehicleService

router = APIRouter(prefix="/vehicles", tags=["차량 마스터"])


@router.get("/manufacturers", response_model=StandardResponse)
async def get_manufacturers(
    origin: Optional[str] = Query(None, description="국산/수입 구분 (domestic, imported)"),
    db: AsyncSession = Depends(get_db)
):
    """
    제조사 목록 조회 API
    
    - 국산/수입 구분 필터링 지원
    - Redis 캐싱 적용 (TTL: 1시간)
    """
    if origin and origin not in ["domestic", "imported"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="origin 파라미터는 'domestic' 또는 'imported'여야 합니다"
        )
    
    manufacturers = await VehicleService.get_manufacturers(db, origin)
    
    return StandardResponse(
        success=True,
        data=manufacturers,
        error=None
    )


@router.get("/model-groups", response_model=StandardResponse)
async def get_model_groups(
    manufacturer: str = Query(..., description="제조사명"),
    origin: Optional[str] = Query(None, description="국산/수입 구분 (domestic, imported)"),
    db: AsyncSession = Depends(get_db)
):
    """
    모델 그룹 목록 조회 API
    
    - 제조사별 모델 그룹 조회
    - Redis 캐싱 적용 (TTL: 1시간)
    """
    if origin and origin not in ["domestic", "imported"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="origin 파라미터는 'domestic' 또는 'imported'여야 합니다"
        )
    
    model_groups = await VehicleService.get_model_groups(db, manufacturer, origin)
    
    return StandardResponse(
        success=True,
        data=model_groups,
        error=None
    )


@router.get("/models", response_model=StandardResponse)
async def get_models(
    manufacturer: Optional[str] = Query(None, description="제조사명"),
    model_group: Optional[str] = Query(None, description="모델 그룹명"),
    origin: Optional[str] = Query(None, description="국산/수입 구분 (domestic, imported)"),
    db: AsyncSession = Depends(get_db)
):
    """
    차량 모델 목록 조회 API
    
    - 제조사/모델 그룹/국산수입 구분 필터링 지원
    - Redis 캐싱 적용 (TTL: 1시간)
    """
    if origin and origin not in ["domestic", "imported"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="origin 파라미터는 'domestic' 또는 'imported'여야 합니다"
        )
    
    models = await VehicleService.get_models(db, manufacturer, model_group, origin)
    
    return StandardResponse(
        success=True,
        data=models,
        error=None
    )


@router.get("/models/{model_id}/details", response_model=StandardResponse)
async def get_model_details(
    model_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    차량 모델 상세 정보 조회 API
    
    - 모델 ID로 상세 정보 조회
    - 연식, 배기량 등 상세 정보 포함
    """
    model_details = await VehicleService.get_model_details(db, model_id)
    
    if not model_details:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="차량 모델을 찾을 수 없습니다"
        )
    
    return StandardResponse(
        success=True,
        data=model_details,
        error=None
    )


@router.get("/classes", response_model=StandardResponse)
async def get_vehicle_classes(
    origin: Optional[str] = Query(None, description="국산/수입 구분 (domestic, imported)"),
    db: AsyncSession = Depends(get_db)
):
    """
    차량 등급 목록 조회 API
    
    - 경차/소형/중형/대형/SUV/스포츠카/슈퍼카 등급 정보
    - 국산/수입 구분 필터링 지원
    """
    if origin and origin not in ["domestic", "imported"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="origin 파라미터는 'domestic' 또는 'imported'여야 합니다"
        )
    
    classes = await VehicleService.get_vehicle_classes(db, origin)
    
    return StandardResponse(
        success=True,
        data=classes,
        error=None
    )


@router.get("/lookup", response_model=StandardResponse)
async def lookup_vehicle_by_plate(
    plate_number: str = Query(..., description="차량번호"),
    db: AsyncSession = Depends(get_db)
):
    """
    차량번호 기반 조회 API (국토교통부 API 연동 기초 작업)
    
    - 차량번호로 차량 정보 조회
    - 국토교통부 API 연동 예정 (현재는 기본 구조만 구현)
    """
    # TODO: 국토교통부 API 연동 구현
    # 현재는 기본 응답만 반환
    
    return StandardResponse(
        success=True,
        data={
            "plate_number": plate_number,
            "message": "국토교통부 API 연동 예정"
        },
        error=None
    )

