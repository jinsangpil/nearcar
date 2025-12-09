"""
운영자 API 엔드포인트
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Dict

from app.core.database import get_db
from app.core.dependencies import require_role, require_admin_only, require_admin_or_staff
from app.schemas.admin import (
    PricePolicyCreateRequest,
    InspectionAssignRequest,
    SettlementCalculateRequest
)
from app.schemas.price_policy import (
    PricePolicyResponse,
    PricePolicyListResponse,
    PricePolicyUpdateRequest
)
from app.services.price_policy_service import PricePolicyService
from app.schemas.vehicle_master import (
    VehicleMasterCreateRequest,
    VehicleMasterUpdateRequest,
    VehicleMasterResponse,
    VehicleMasterListResponse,
    VehicleMasterSyncRequest,
    VehicleMasterSyncResponse
)
from app.schemas.manufacturer import (
    ManufacturerCreateRequest,
    ManufacturerUpdateRequest,
    ManufacturerResponse,
    ManufacturerListResponse
)
from app.schemas.vehicle_model import (
    VehicleModelCreateRequest,
    VehicleModelUpdateRequest,
    VehicleModelResponse,
    VehicleModelListResponse,
    VehicleModelSyncRequest,
    VehicleModelSyncResponse
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
from app.schemas.package import (
    PackageCreateRequest,
    PackageUpdateRequest,
    PackageResponse,
    PackageListResponse
)
from app.services.admin_service import AdminService
from app.services.user_service import UserService
from app.services.package_service import PackageService
from app.services.vehicle_master_service import VehicleMasterService
from app.services.manufacturer_service import ManufacturerService
from app.services.vehicle_model_service import VehicleModelService
from app.models.user import User
import uuid

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


# ==================== 차량 마스터 관리 API ====================
@router.post("/vehicles/master", response_model=StandardResponse)
async def create_vehicle_master(
    request: VehicleMasterCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_only)
):
    """
    차량 마스터 생성 API
    
    관리자 권한 필요.
    """
    try:
        new_master = await VehicleMasterService.create_vehicle_master(
            db=db,
            origin=request.origin,
            manufacturer=request.manufacturer,
            model_group=request.model_group,
            model_detail=request.model_detail,
            vehicle_class=request.vehicle_class,
            start_year=request.start_year,
            end_year=request.end_year,
            is_active=request.is_active
        )
        return StandardResponse(success=True, data=new_master)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"차량 마스터 생성 중 오류 발생: {str(e)}")


@router.get("/vehicles/master/{master_id}", response_model=StandardResponse)
async def get_vehicle_master_detail(
    master_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_staff)
):
    """
    차량 마스터 상세 조회 API
    
    관리자/직원 권한 필요.
    """
    try:
        master_uuid = uuid.UUID(master_id)
        master = await VehicleMasterService.get_vehicle_master(db, master_uuid)
        if not master:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="차량 마스터를 찾을 수 없습니다.")
        return StandardResponse(success=True, data=master)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="유효하지 않은 차량 마스터 ID 형식입니다.")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"차량 마스터 조회 중 오류 발생: {str(e)}")


@router.patch("/vehicles/master/{master_id}", response_model=StandardResponse)
async def update_vehicle_master(
    master_id: str,
    request: VehicleMasterUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_only)
):
    """
    차량 마스터 수정 API
    
    관리자 권한 필요.
    """
    try:
        master_uuid = uuid.UUID(master_id)
        updated_master = await VehicleMasterService.update_vehicle_master(
            db=db,
            master_id=master_uuid,
            origin=request.origin,
            manufacturer=request.manufacturer,
            model_group=request.model_group,
            model_detail=request.model_detail,
            vehicle_class=request.vehicle_class,
            start_year=request.start_year,
            end_year=request.end_year,
            is_active=request.is_active
        )
        if not updated_master:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="차량 마스터를 찾을 수 없습니다.")
        return StandardResponse(success=True, data=updated_master)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"차량 마스터 수정 중 오류 발생: {str(e)}")


@router.delete("/vehicles/master/{master_id}", response_model=StandardResponse)
async def delete_vehicle_master(
    master_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_only)
):
    """
    차량 마스터 삭제 API (soft delete)
    
    관리자 권한 필요.
    """
    try:
        master_uuid = uuid.UUID(master_id)
        success = await VehicleMasterService.delete_vehicle_master(db, master_uuid)
        if not success:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="차량 마스터를 찾을 수 없습니다.")
        return StandardResponse(success=True, data={"message": "차량 마스터가 성공적으로 삭제되었습니다."})
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"차량 마스터 삭제 중 오류 발생: {str(e)}")


@router.get("/vehicles/master", response_model=StandardResponse)
async def list_vehicle_masters(
    origin: Optional[str] = Query(None, description="국산/수입 필터 (domestic, imported)"),
    manufacturer: Optional[str] = Query(None, description="제조사 필터"),
    vehicle_class: Optional[str] = Query(None, description="차량 등급 필터"),
    search: Optional[str] = Query(None, description="검색어 (제조사, 모델명)"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    limit: int = Query(20, ge=1, le=100, description="페이지 크기"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_staff)
):
    """
    차량 마스터 목록 조회 API
    
    관리자/직원 권한 필요.
    """
    try:
        masters_data = await VehicleMasterService.list_vehicle_masters(
            db=db,
            origin=origin,
            manufacturer=manufacturer,
            vehicle_class=vehicle_class,
            search=search,
            page=page,
            limit=limit
        )
        return StandardResponse(success=True, data=masters_data)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"차량 마스터 목록 조회 중 오류 발생: {str(e)}")


@router.post("/vehicles/master/sync", response_model=StandardResponse)
async def sync_vehicle_masters(
    request: VehicleMasterSyncRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_only)
):
    """
    차량 마스터 일괄 동기화 API
    
    스크래핑 데이터를 일괄 동기화합니다.
    관리자 권한 필요.
    """
    try:
        sync_data = [item.model_dump() for item in request.data]
        result = await VehicleMasterService.sync_vehicle_masters(db, sync_data)
        return StandardResponse(success=True, data=result)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"차량 마스터 동기화 중 오류 발생: {str(e)}")


# ==================== 제조사 관리 API ====================
@router.post("/manufacturers", response_model=StandardResponse)
async def create_manufacturer(
    request: ManufacturerCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_only)
):
    """
    새 제조사를 생성합니다.
    관리자 권한 필요.
    """
    try:
        new_manufacturer = await ManufacturerService.create_manufacturer(
            db=db,
            name=request.name,
            origin=request.origin,
            is_active=request.is_active
        )
        return StandardResponse(success=True, data=new_manufacturer)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"제조사 생성 중 오류 발생: {str(e)}")


@router.get("/manufacturers/{manufacturer_id}", response_model=StandardResponse)
async def get_manufacturer_detail(
    manufacturer_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_staff)
):
    """
    특정 제조사 상세 정보를 조회합니다.
    관리자/직원 권한 필요.
    """
    try:
        manufacturer_uuid = uuid.UUID(manufacturer_id)
        manufacturer = await ManufacturerService.get_manufacturer(db, manufacturer_uuid)
        if not manufacturer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="제조사를 찾을 수 없습니다.")
        return StandardResponse(success=True, data=manufacturer)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="유효하지 않은 제조사 ID 형식입니다.")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"제조사 조회 중 오류 발생: {str(e)}")


@router.patch("/manufacturers/{manufacturer_id}", response_model=StandardResponse)
async def update_manufacturer(
    manufacturer_id: str,
    request: ManufacturerUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_only)
):
    """
    제조사 정보를 업데이트합니다.
    관리자 권한 필요.
    """
    try:
        manufacturer_uuid = uuid.UUID(manufacturer_id)
        updated_manufacturer = await ManufacturerService.update_manufacturer(
            db=db,
            manufacturer_id=manufacturer_uuid,
            name=request.name,
            origin=request.origin,
            is_active=request.is_active
        )
        if not updated_manufacturer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="제조사를 찾을 수 없습니다.")
        return StandardResponse(success=True, data=updated_manufacturer)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"제조사 업데이트 중 오류 발생: {str(e)}")


@router.delete("/manufacturers/{manufacturer_id}", response_model=StandardResponse)
async def delete_manufacturer(
    manufacturer_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_only)
):
    """
    제조사를 삭제합니다 (soft delete).
    관리자 권한 필요.
    """
    try:
        manufacturer_uuid = uuid.UUID(manufacturer_id)
        success = await ManufacturerService.delete_manufacturer(db, manufacturer_uuid)
        if not success:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="제조사를 찾을 수 없습니다.")
        return StandardResponse(success=True, data={"message": "제조사가 성공적으로 삭제되었습니다."})
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"제조사 삭제 중 오류 발생: {str(e)}")


@router.get("/manufacturers", response_model=StandardResponse)
async def list_manufacturers(
    origin: Optional[str] = Query(None, description="국산/수입 필터 (domestic, imported)"),
    search: Optional[str] = Query(None, description="제조사명 검색"),
    is_active: Optional[bool] = Query(None, description="활성화 여부 필터"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    limit: int = Query(20, ge=1, le=100, description="페이지 크기"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_staff)
):
    """
    제조사 목록을 조회합니다.
    관리자/직원 권한 필요.
    """
    try:
        manufacturers_data = await ManufacturerService.list_manufacturers(
            db=db,
            origin=origin,
            search=search,
            is_active=is_active,
            page=page,
            limit=limit
        )
        return StandardResponse(success=True, data=manufacturers_data)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"제조사 목록 조회 중 오류 발생: {str(e)}")


# ==================== 차량 모델 관리 API ====================
@router.post("/vehicle-models", response_model=StandardResponse)
async def create_vehicle_model(
    request: VehicleModelCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_only)
):
    """
    새 차량 모델을 생성합니다.
    관리자 권한 필요.
    """
    try:
        new_model = await VehicleModelService.create_vehicle_model(
            db=db,
            manufacturer_id=request.manufacturer_id,
            model_group=request.model_group,
            model_detail=request.model_detail,
            vehicle_class=request.vehicle_class,
            start_year=request.start_year,
            end_year=request.end_year,
            is_active=request.is_active
        )
        # 제조사 정보 포함하여 응답
        manufacturer = await ManufacturerService.get_manufacturer(db, request.manufacturer_id)
        response_data = {
            "id": new_model.id,
            "manufacturer_id": new_model.manufacturer_id,
            "manufacturer_name": manufacturer.name if manufacturer else None,
            "manufacturer_origin": manufacturer.origin if manufacturer else None,
            "model_group": new_model.model_group,
            "model_detail": new_model.model_detail,
            "vehicle_class": new_model.vehicle_class,
            "start_year": new_model.start_year,
            "end_year": new_model.end_year,
            "is_active": new_model.is_active,
            "created_at": new_model.created_at,
            "updated_at": new_model.updated_at,
        }
        return StandardResponse(success=True, data=response_data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"차량 모델 생성 중 오류 발생: {str(e)}")


@router.get("/vehicle-models/{model_id}", response_model=StandardResponse)
async def get_vehicle_model_detail(
    model_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_staff)
):
    """
    특정 차량 모델 상세 정보를 조회합니다.
    관리자/직원 권한 필요.
    """
    try:
        model_uuid = uuid.UUID(model_id)
        model = await VehicleModelService.get_vehicle_model(db, model_uuid)
        if not model:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="차량 모델을 찾을 수 없습니다.")
        
        # 제조사 정보 포함
        manufacturer = await ManufacturerService.get_manufacturer(db, model.manufacturer_id)
        response_data = {
            "id": model.id,
            "manufacturer_id": model.manufacturer_id,
            "manufacturer_name": manufacturer.name if manufacturer else None,
            "manufacturer_origin": manufacturer.origin if manufacturer else None,
            "model_group": model.model_group,
            "model_detail": model.model_detail,
            "vehicle_class": model.vehicle_class,
            "start_year": model.start_year,
            "end_year": model.end_year,
            "is_active": model.is_active,
            "created_at": model.created_at,
            "updated_at": model.updated_at,
        }
        return StandardResponse(success=True, data=response_data)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="유효하지 않은 차량 모델 ID 형식입니다.")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"차량 모델 조회 중 오류 발생: {str(e)}")


@router.patch("/vehicle-models/{model_id}", response_model=StandardResponse)
async def update_vehicle_model(
    model_id: str,
    request: VehicleModelUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_only)
):
    """
    차량 모델 정보를 업데이트합니다.
    관리자 권한 필요.
    """
    try:
        model_uuid = uuid.UUID(model_id)
        updated_model = await VehicleModelService.update_vehicle_model(
            db=db,
            model_id=model_uuid,
            manufacturer_id=request.manufacturer_id,
            model_group=request.model_group,
            model_detail=request.model_detail,
            vehicle_class=request.vehicle_class,
            start_year=request.start_year,
            end_year=request.end_year,
            is_active=request.is_active
        )
        if not updated_model:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="차량 모델을 찾을 수 없습니다.")
        
        # 제조사 정보 포함
        manufacturer = await ManufacturerService.get_manufacturer(db, updated_model.manufacturer_id)
        response_data = {
            "id": updated_model.id,
            "manufacturer_id": updated_model.manufacturer_id,
            "manufacturer_name": manufacturer.name if manufacturer else None,
            "manufacturer_origin": manufacturer.origin if manufacturer else None,
            "model_group": updated_model.model_group,
            "model_detail": updated_model.model_detail,
            "vehicle_class": updated_model.vehicle_class,
            "start_year": updated_model.start_year,
            "end_year": updated_model.end_year,
            "is_active": updated_model.is_active,
            "created_at": updated_model.created_at,
            "updated_at": updated_model.updated_at,
        }
        return StandardResponse(success=True, data=response_data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"차량 모델 업데이트 중 오류 발생: {str(e)}")


@router.delete("/vehicle-models/{model_id}", response_model=StandardResponse)
async def delete_vehicle_model(
    model_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_only)
):
    """
    차량 모델을 삭제합니다 (soft delete).
    관리자 권한 필요.
    """
    try:
        model_uuid = uuid.UUID(model_id)
        success = await VehicleModelService.delete_vehicle_model(db, model_uuid)
        if not success:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="차량 모델을 찾을 수 없습니다.")
        return StandardResponse(success=True, data={"message": "차량 모델이 성공적으로 삭제되었습니다."})
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"차량 모델 삭제 중 오류 발생: {str(e)}")


@router.get("/vehicle-models", response_model=StandardResponse)
async def list_vehicle_models(
    manufacturer_id: Optional[str] = Query(None, description="제조사 ID 필터"),
    origin: Optional[str] = Query(None, description="국산/수입 필터 (domestic, imported)"),
    vehicle_class: Optional[str] = Query(None, description="차량 등급 필터"),
    model_group: Optional[str] = Query(None, description="모델 그룹 필터"),
    model_detail: Optional[str] = Query(None, description="모델 상세 필터"),
    search: Optional[str] = Query(None, description="검색어 (제조사명, 모델명)"),
    is_active: Optional[bool] = Query(None, description="활성화 여부 필터"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    limit: int = Query(20, ge=1, le=100, description="페이지 크기"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_staff)
):
    """
    차량 모델 목록을 조회합니다.
    관리자/직원 권한 필요.
    """
    try:
        manufacturer_uuid = uuid.UUID(manufacturer_id) if manufacturer_id else None
        models_data = await VehicleModelService.list_vehicle_models(
            db=db,
            manufacturer_id=manufacturer_uuid,
            origin=origin,
            vehicle_class=vehicle_class,
            model_group=model_group,
            model_detail=model_detail,
            search=search,
            is_active=is_active,
            page=page,
            limit=limit
        )
        return StandardResponse(success=True, data=models_data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"차량 모델 목록 조회 중 오류 발생: {str(e)}")


@router.post("/vehicle-models/sync", response_model=StandardResponse)
async def sync_vehicle_models(
    request: VehicleModelSyncRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_only)
):
    """
    차량 모델 데이터를 일괄 동기화합니다.
    관리자 권한 필요.
    """
    try:
        sync_data = [item.model_dump() for item in request.items]
        result = await VehicleModelService.sync_vehicle_models(db, sync_data)
        return StandardResponse(success=True, data=result)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"차량 모델 동기화 중 오류 발생: {str(e)}")


@router.get("/prices", response_model=StandardResponse)
async def list_price_policies(
    origin: Optional[str] = Query(None, description="국산/수입 필터", pattern="^(domestic|imported)$"),
    vehicle_class: Optional[str] = Query(None, description="차량 등급 필터", pattern="^(compact|small|mid|large|suv|sports|supercar)$"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    limit: int = Query(100, ge=1, le=100, description="페이지 크기"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    가격 정책 목록 조회 API
    
    국산/수입, 차량 등급별로 필터링하여 가격 정책 목록을 조회합니다.
    """
    try:
        result = await PricePolicyService.list_price_policies(
            db=db,
            origin=origin,
            vehicle_class=vehicle_class,
            page=page,
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
            detail=f"가격 정책 목록 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/prices/{policy_id}", response_model=StandardResponse)
async def get_price_policy(
    policy_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    가격 정책 상세 조회 API
    
    특정 가격 정책의 상세 정보를 조회합니다.
    """
    try:
        result = await PricePolicyService.get_price_policy(
            db=db,
            policy_id=policy_id
        )
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="가격 정책을 찾을 수 없습니다"
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
            detail=f"가격 정책 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.post("/prices", response_model=StandardResponse)
async def create_price_policy(
    request: PricePolicyCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    가격 정책 생성 API
    
    차량 등급별 추가 요금 정책을 생성합니다.
    Redis 캐시가 자동으로 무효화됩니다.
    """
    try:
        result = await PricePolicyService.create_price_policy(
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
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"가격 정책 생성 중 오류가 발생했습니다: {str(e)}"
        )


@router.patch("/prices/{policy_id}", response_model=StandardResponse)
async def update_price_policy(
    policy_id: str,
    request: PricePolicyUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    가격 정책 수정 API
    
    가격 정책의 추가 금액을 수정합니다.
    Redis 캐시가 자동으로 무효화됩니다.
    """
    try:
        result = await PricePolicyService.update_price_policy(
            db=db,
            policy_id=policy_id,
            add_amount=request.add_amount
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
            detail=f"가격 정책 수정 중 오류가 발생했습니다: {str(e)}"
        )


@router.delete("/prices/{policy_id}", response_model=StandardResponse)
async def delete_price_policy(
    policy_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_only)
):
    """
    가격 정책 삭제 API
    
    가격 정책을 삭제합니다.
    Redis 캐시가 자동으로 무효화됩니다.
    """
    try:
        result = await PricePolicyService.delete_price_policy(
            db=db,
            policy_id=policy_id
        )
        
        return StandardResponse(
            success=True,
            data={"deleted": result},
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
            detail=f"가격 정책 삭제 중 오류가 발생했습니다: {str(e)}"
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


# ==================== 패키지 관리 API ====================

@router.post("/packages", response_model=StandardResponse)
async def create_package(
    request: PackageCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    패키지 생성 API
    
    관리자가 새 패키지를 생성합니다.
    관리자/직원 권한 필요.
    """
    try:
        result = await PackageService.create_package(
            db=db,
            name=request.name,
            base_price=request.base_price,
            included_items=request.included_items
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
            detail=f"패키지 생성 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/packages/{package_id}", response_model=StandardResponse)
async def get_package(
    package_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    패키지 상세 조회 API
    
    관리자가 패키지 상세 정보를 조회합니다.
    관리자/직원 권한 필요.
    """
    try:
        result = await PackageService.get_package(db=db, package_id=package_id)
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="패키지를 찾을 수 없습니다"
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
            detail=f"패키지 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.patch("/packages/{package_id}", response_model=StandardResponse)
async def update_package(
    package_id: str,
    request: PackageUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    패키지 수정 API
    
    관리자가 패키지 정보를 수정합니다.
    관리자/직원 권한 필요.
    """
    try:
        result = await PackageService.update_package(
            db=db,
            package_id=package_id,
            name=request.name,
            base_price=request.base_price,
            included_items=request.included_items,
            is_active=request.is_active
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
            detail=f"패키지 수정 중 오류가 발생했습니다: {str(e)}"
        )


@router.delete("/packages/{package_id}", response_model=StandardResponse)
async def delete_package(
    package_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    패키지 삭제 API (Soft Delete)
    
    관리자가 패키지를 삭제합니다. 실제로는 is_active를 False로 변경합니다.
    활성 신청 건이 있으면 삭제할 수 없습니다.
    관리자/직원 권한 필요.
    """
    try:
        result = await PackageService.delete_package(db=db, package_id=package_id)
        
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
            detail=f"패키지 삭제 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/packages", response_model=StandardResponse)
async def list_packages(
    search: Optional[str] = Query(None, description="검색어 (패키지 이름)"),
    is_active: Optional[bool] = Query(None, description="활성화 여부 필터"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    limit: int = Query(20, ge=1, le=100, description="페이지 크기"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    패키지 목록 조회 API
    
    필터링, 검색, 페이지네이션을 지원합니다.
    관리자/직원 권한 필요.
    """
    try:
        result = await PackageService.list_packages(
            db=db,
            search=search,
            is_active=is_active,
            page=page,
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
            detail=f"패키지 목록 조회 중 오류가 발생했습니다: {str(e)}"
        )

