"""
차량 모델 관리 서비스
"""
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc
from datetime import datetime, timezone
import uuid
import json

from app.models.vehicle_model import VehicleModel
from app.models.manufacturer import Manufacturer
from app.core.redis import get_redis
from loguru import logger


class VehicleModelService:
    """차량 모델 관리 서비스"""

    CACHE_PREFIX = "vehicle_models:"
    CACHE_TTL = 3600  # 1시간

    @staticmethod
    async def create_vehicle_model(
        db: AsyncSession,
        manufacturer_id: uuid.UUID,
        model_group: str,
        model_detail: Optional[str],
        vehicle_class: str,
        start_year: int,
        end_year: Optional[int],
        is_active: bool = True
    ) -> VehicleModel:
        """새 차량 모델을 생성합니다."""
        # 제조사 존재 확인
        manufacturer_query = select(Manufacturer).where(Manufacturer.id == manufacturer_id)
        manufacturer_result = await db.execute(manufacturer_query)
        manufacturer = manufacturer_result.scalar_one_or_none()
        
        if not manufacturer:
            raise ValueError(f"제조사를 찾을 수 없습니다: {manufacturer_id}")
        
        # 중복 확인
        query = select(VehicleModel).where(
            and_(
                VehicleModel.manufacturer_id == manufacturer_id,
                VehicleModel.model_group == model_group,
                VehicleModel.model_detail == model_detail
            )
        )
        result = await db.execute(query)
        existing = result.scalar_one_or_none()
        
        if existing:
            raise ValueError(f"이미 존재하는 차량 모델입니다: {model_group} {model_detail or ''}")
        
        new_model = VehicleModel(
            manufacturer_id=manufacturer_id,
            model_group=model_group,
            model_detail=model_detail,
            vehicle_class=vehicle_class,
            start_year=start_year,
            end_year=end_year,
            is_active=is_active
        )
        db.add(new_model)
        await db.commit()
        await db.refresh(new_model)
        
        await VehicleModelService.invalidate_cache()
        
        return new_model

    @staticmethod
    async def get_vehicle_model(db: AsyncSession, model_id: uuid.UUID) -> Optional[VehicleModel]:
        """특정 차량 모델을 조회합니다."""
        cache_key = f"{VehicleModelService.CACHE_PREFIX}detail:{model_id}"
        redis = await get_redis()
        cached_data = await redis.get(cache_key)
        if cached_data:
            return VehicleModel(**json.loads(cached_data))

        query = select(VehicleModel).where(VehicleModel.id == model_id)
        result = await db.execute(query)
        model = result.scalar_one_or_none()
        
        if model:
            await redis.setex(cache_key, VehicleModelService.CACHE_TTL, json.dumps({
                "id": str(model.id),
                "manufacturer_id": str(model.manufacturer_id),
                "model_group": model.model_group,
                "model_detail": model.model_detail,
                "vehicle_class": model.vehicle_class,
                "start_year": model.start_year,
                "end_year": model.end_year,
                "is_active": model.is_active,
                "created_at": model.created_at.isoformat() if model.created_at else None,
                "updated_at": model.updated_at.isoformat() if model.updated_at else None,
            }, default=str))
        
        return model

    @staticmethod
    async def update_vehicle_model(
        db: AsyncSession,
        model_id: uuid.UUID,
        manufacturer_id: Optional[uuid.UUID] = None,
        model_group: Optional[str] = None,
        model_detail: Optional[str] = None,
        vehicle_class: Optional[str] = None,
        start_year: Optional[int] = None,
        end_year: Optional[int] = None,
        is_active: Optional[bool] = None
    ) -> Optional[VehicleModel]:
        """차량 모델 정보를 업데이트합니다."""
        model = await VehicleModelService.get_vehicle_model(db, model_id)
        if not model:
            return None

        if manufacturer_id is not None:
            # 제조사 존재 확인
            manufacturer_query = select(Manufacturer).where(Manufacturer.id == manufacturer_id)
            manufacturer_result = await db.execute(manufacturer_query)
            manufacturer = manufacturer_result.scalar_one_or_none()
            
            if not manufacturer:
                raise ValueError(f"제조사를 찾을 수 없습니다: {manufacturer_id}")
            
            model.manufacturer_id = manufacturer_id
        if model_group is not None:
            model.model_group = model_group
        if model_detail is not None:
            model.model_detail = model_detail
        if vehicle_class is not None:
            model.vehicle_class = vehicle_class
        if start_year is not None:
            model.start_year = start_year
        if end_year is not None:
            model.end_year = end_year
        if is_active is not None:
            model.is_active = is_active
            
        model.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(model)
        
        await VehicleModelService.invalidate_cache()
        
        return model

    @staticmethod
    async def delete_vehicle_model(db: AsyncSession, model_id: uuid.UUID) -> bool:
        """차량 모델을 삭제합니다 (soft delete)."""
        model = await VehicleModelService.get_vehicle_model(db, model_id)
        if not model:
            return False

        model.is_active = False
        model.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(model)
        
        await VehicleModelService.invalidate_cache()
        
        return True

    @staticmethod
    async def list_vehicle_models(
        db: AsyncSession,
        manufacturer_id: Optional[uuid.UUID] = None,
        origin: Optional[str] = None,
        vehicle_class: Optional[str] = None,
        model_group: Optional[str] = None,
        model_detail: Optional[str] = None,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
        page: int = 1,
        limit: int = 20
    ) -> Dict[str, Any]:
        """차량 모델 목록을 조회합니다."""
        # 제조사와 조인하여 조회
        query = select(
            VehicleModel,
            Manufacturer.name.label("manufacturer_name"),
            Manufacturer.origin.label("manufacturer_origin")
        ).join(Manufacturer, VehicleModel.manufacturer_id == Manufacturer.id)
        
        count_query = select(func.count(VehicleModel.id)).join(
            Manufacturer, VehicleModel.manufacturer_id == Manufacturer.id
        )

        if manufacturer_id:
            query = query.where(VehicleModel.manufacturer_id == manufacturer_id)
            count_query = count_query.where(VehicleModel.manufacturer_id == manufacturer_id)
        if origin:
            query = query.where(Manufacturer.origin == origin)
            count_query = count_query.where(Manufacturer.origin == origin)
        if vehicle_class:
            query = query.where(VehicleModel.vehicle_class == vehicle_class)
            count_query = count_query.where(VehicleModel.vehicle_class == vehicle_class)
        if model_group:
            query = query.where(VehicleModel.model_group.ilike(f"%{model_group}%"))
            count_query = count_query.where(VehicleModel.model_group.ilike(f"%{model_group}%"))
        if model_detail:
            query = query.where(VehicleModel.model_detail.ilike(f"%{model_detail}%"))
            count_query = count_query.where(VehicleModel.model_detail.ilike(f"%{model_detail}%"))
        if search:
            search_pattern = f"%{search}%"
            query = query.where(
                or_(
                    Manufacturer.name.ilike(search_pattern),
                    VehicleModel.model_group.ilike(search_pattern),
                    VehicleModel.model_detail.ilike(search_pattern)
                )
            )
            count_query = count_query.where(
                or_(
                    Manufacturer.name.ilike(search_pattern),
                    VehicleModel.model_group.ilike(search_pattern),
                    VehicleModel.model_detail.ilike(search_pattern)
                )
            )
        if is_active is not None:
            query = query.where(VehicleModel.is_active == is_active)
            count_query = count_query.where(VehicleModel.is_active == is_active)

        total_count_result = await db.execute(count_query)
        total_count = total_count_result.scalar_one()

        query = query.order_by(
            Manufacturer.name,
            VehicleModel.model_group,
            VehicleModel.start_year.desc()
        ).offset((page - 1) * limit).limit(limit)
        
        result = await db.execute(query)
        rows = result.all()

        model_list = []
        for row in rows:
            model = row[0]  # VehicleModel 객체
            manufacturer_name = row[1]  # manufacturer_name
            manufacturer_origin = row[2]  # manufacturer_origin
            
            model_list.append({
                "id": str(model.id),
                "manufacturer_id": str(model.manufacturer_id),
                "manufacturer_name": manufacturer_name,
                "manufacturer_origin": manufacturer_origin,
                "model_group": model.model_group,
                "model_detail": model.model_detail,
                "vehicle_class": model.vehicle_class,
                "start_year": model.start_year,
                "end_year": model.end_year,
                "is_active": model.is_active,
                "created_at": model.created_at.isoformat() if model.created_at else None,
                "updated_at": model.updated_at.isoformat() if model.updated_at else None,
            })

        return {
            "items": model_list,
            "total": total_count,
            "page": page,
            "limit": limit,
            "total_pages": (total_count + limit - 1) // limit,
        }

    @staticmethod
    async def sync_vehicle_models(db: AsyncSession, items: List[Dict[str, Any]]) -> Dict[str, int]:
        """
        차량 모델 데이터를 일괄 동기화합니다.
        기존 데이터와 비교하여 업데이트하거나 새로 생성합니다.
        """
        created_count = 0
        updated_count = 0
        failed_count = 0
        errors = []
        
        for item in items:
            try:
                manufacturer_id = uuid.UUID(item["manufacturer_id"]) if isinstance(item["manufacturer_id"], str) else item["manufacturer_id"]
                
                # 제조사 존재 확인
                manufacturer_query = select(Manufacturer).where(Manufacturer.id == manufacturer_id)
                manufacturer_result = await db.execute(manufacturer_query)
                manufacturer = manufacturer_result.scalar_one_or_none()
                
                if not manufacturer:
                    failed_count += 1
                    errors.append(f"제조사를 찾을 수 없습니다: {manufacturer_id}")
                    continue
                
                # 기존 모델 확인
                query = select(VehicleModel).where(
                    and_(
                        VehicleModel.manufacturer_id == manufacturer_id,
                        VehicleModel.model_group == item["model_group"],
                        VehicleModel.model_detail == item.get("model_detail")
                    )
                )
                result = await db.execute(query)
                existing = result.scalar_one_or_none()

                if existing:
                    # 업데이트
                    existing.vehicle_class = item["vehicle_class"]
                    existing.start_year = item["start_year"]
                    existing.end_year = item.get("end_year")
                    existing.is_active = item.get("is_active", True)
                    existing.updated_at = datetime.now(timezone.utc)
                    updated_count += 1
                else:
                    # 생성
                    new_model = VehicleModel(
                        manufacturer_id=manufacturer_id,
                        model_group=item["model_group"],
                        model_detail=item.get("model_detail"),
                        vehicle_class=item["vehicle_class"],
                        start_year=item["start_year"],
                        end_year=item.get("end_year"),
                        is_active=item.get("is_active", True)
                    )
                    db.add(new_model)
                    created_count += 1
            except Exception as e:
                failed_count += 1
                errors.append(f"동기화 실패: {str(e)}")
                logger.error(f"차량 모델 동기화 오류: {e}")
        
        await db.commit()
        await VehicleModelService.invalidate_cache()
        
        return {
            "created": created_count,
            "updated": updated_count,
            "failed": failed_count,
            "errors": errors
        }

    @staticmethod
    async def invalidate_cache():
        """차량 모델 관련 캐시를 무효화합니다."""
        try:
            redis = await get_redis()
            keys = await redis.keys(f"{VehicleModelService.CACHE_PREFIX}*")
            if keys:
                await redis.delete(*keys)
                logger.info(f"Redis cache invalidated: {len(keys)} keys for vehicle_models")
        except Exception as e:
            logger.error(f"Redis cache invalidation failed: {e}")

