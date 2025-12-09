"""
제조사 관리 서비스
"""
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from datetime import datetime
import uuid
import json
from datetime import timezone

from app.models.manufacturer import Manufacturer
from app.core.redis import get_redis
from loguru import logger


class ManufacturerService:
    """제조사 관리 서비스"""

    CACHE_PREFIX = "manufacturers:"
    CACHE_TTL = 3600  # 1시간

    @staticmethod
    async def create_manufacturer(
        db: AsyncSession,
        name: str,
        origin: str,
        is_active: bool = True
    ) -> Manufacturer:
        """새 제조사를 생성합니다."""
        # 중복 확인
        query = select(Manufacturer).where(
            and_(
                Manufacturer.name == name,
                Manufacturer.origin == origin
            )
        )
        result = await db.execute(query)
        existing = result.scalar_one_or_none()
        
        if existing:
            raise ValueError(f"이미 존재하는 제조사입니다: {name} ({origin})")
        
        new_manufacturer = Manufacturer(
            name=name,
            origin=origin,
            is_active=is_active
        )
        db.add(new_manufacturer)
        await db.commit()
        await db.refresh(new_manufacturer)
        
        await ManufacturerService.invalidate_cache()
        
        return new_manufacturer

    @staticmethod
    async def get_manufacturer(db: AsyncSession, manufacturer_id: uuid.UUID) -> Optional[Manufacturer]:
        """특정 제조사를 조회합니다."""
        cache_key = f"{ManufacturerService.CACHE_PREFIX}detail:{manufacturer_id}"
        redis = await get_redis()
        cached_data = await redis.get(cache_key)
        if cached_data:
            return Manufacturer(**json.loads(cached_data))

        query = select(Manufacturer).where(Manufacturer.id == manufacturer_id)
        result = await db.execute(query)
        manufacturer = result.scalar_one_or_none()
        
        if manufacturer:
            await redis.setex(cache_key, ManufacturerService.CACHE_TTL, json.dumps({
                "id": str(manufacturer.id),
                "name": manufacturer.name,
                "origin": manufacturer.origin,
                "is_active": manufacturer.is_active,
                "created_at": manufacturer.created_at.isoformat() if manufacturer.created_at else None,
                "updated_at": manufacturer.updated_at.isoformat() if manufacturer.updated_at else None,
            }, default=str))
        
        return manufacturer

    @staticmethod
    async def update_manufacturer(
        db: AsyncSession,
        manufacturer_id: uuid.UUID,
        name: Optional[str] = None,
        origin: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> Optional[Manufacturer]:
        """제조사 정보를 업데이트합니다."""
        manufacturer = await ManufacturerService.get_manufacturer(db, manufacturer_id)
        if not manufacturer:
            return None

        if name is not None:
            # 이름 변경 시 중복 확인
            if name != manufacturer.name or (origin and origin != manufacturer.origin):
                check_query = select(Manufacturer).where(
                    and_(
                        Manufacturer.name == name,
                        Manufacturer.origin == origin if origin else manufacturer.origin,
                        Manufacturer.id != manufacturer_id
                    )
                )
                result = await db.execute(check_query)
                if result.scalar_one_or_none():
                    raise ValueError(f"이미 존재하는 제조사입니다: {name} ({origin or manufacturer.origin})")
            
            manufacturer.name = name
        if origin is not None:
            manufacturer.origin = origin
        if is_active is not None:
            manufacturer.is_active = is_active
            
        manufacturer.updated_at = func.now()
        await db.commit()
        await db.refresh(manufacturer)
        
        await ManufacturerService.invalidate_cache()
        
        return manufacturer

    @staticmethod
    async def delete_manufacturer(db: AsyncSession, manufacturer_id: uuid.UUID) -> bool:
        """제조사를 삭제합니다 (soft delete)."""
        manufacturer = await ManufacturerService.get_manufacturer(db, manufacturer_id)
        if not manufacturer:
            return False

        manufacturer.is_active = False
        manufacturer.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(manufacturer)
        
        await ManufacturerService.invalidate_cache()
        
        return True

    @staticmethod
    async def list_manufacturers(
        db: AsyncSession,
        origin: Optional[str] = None,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
        page: int = 1,
        limit: int = 20
    ) -> Dict[str, Any]:
        """제조사 목록을 조회합니다."""
        query = select(Manufacturer)
        count_query = select(func.count(Manufacturer.id))

        if origin:
            query = query.where(Manufacturer.origin == origin)
            count_query = count_query.where(Manufacturer.origin == origin)
        if search:
            query = query.where(Manufacturer.name.ilike(f"%{search}%"))
            count_query = count_query.where(Manufacturer.name.ilike(f"%{search}%"))
        if is_active is not None:
            query = query.where(Manufacturer.is_active == is_active)
            count_query = count_query.where(Manufacturer.is_active == is_active)

        total_count_result = await db.execute(count_query)
        total_count = total_count_result.scalar_one()

        query = query.order_by(Manufacturer.name).offset((page - 1) * limit).limit(limit)
        result = await db.execute(query)
        manufacturers = result.scalars().all()

        manufacturer_list = [
            {
                "id": str(mfr.id),
                "name": mfr.name,
                "origin": mfr.origin,
                "is_active": mfr.is_active,
                "created_at": mfr.created_at.isoformat() if mfr.created_at else None,
                "updated_at": mfr.updated_at.isoformat() if mfr.updated_at else None,
            }
            for mfr in manufacturers
        ]

        return {
            "items": manufacturer_list,
            "total": total_count,
            "page": page,
            "limit": limit,
            "total_pages": (total_count + limit - 1) // limit,
        }

    @staticmethod
    async def invalidate_cache():
        """제조사 관련 캐시를 무효화합니다."""
        try:
            redis = await get_redis()
            keys = await redis.keys(f"{ManufacturerService.CACHE_PREFIX}*")
            if keys:
                await redis.delete(*keys)
                logger.info(f"Redis cache invalidated: {len(keys)} keys for manufacturers")
        except Exception as e:
            logger.error(f"Redis cache invalidation failed: {e}")

