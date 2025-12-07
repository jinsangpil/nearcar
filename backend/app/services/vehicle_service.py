"""
차량 마스터 데이터 서비스
비즈니스 로직 및 캐싱 처리
"""
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, distinct, func
from sqlalchemy.orm import selectinload
import json

from app.models.vehicle_master import VehicleMaster
from app.models.price_policy import PricePolicy
from app.core.redis import get_redis


class VehicleService:
    """차량 마스터 데이터 서비스"""
    
    CACHE_TTL = 3600  # 1시간
    
    @staticmethod
    async def get_manufacturers(
        db: AsyncSession,
        origin: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        제조사 목록 조회 (Redis 캐싱 적용)
        
        Args:
            db: 데이터베이스 세션
            origin: 국산/수입 구분 (domestic, imported)
        
        Returns:
            제조사 목록
        """
        # 캐시 키 생성
        cache_key = f"vehicles:manufacturers:{origin or 'all'}"
        
        # Redis에서 캐시 확인
        try:
            redis = await get_redis()
            cached_data = await redis.get(cache_key)
            if cached_data:
                return json.loads(cached_data)
        except Exception:
            # Redis 오류 시 DB에서 직접 조회
            pass
        
        # DB에서 조회
        query = select(distinct(VehicleMaster.manufacturer), VehicleMaster.origin)
        if origin:
            query = query.where(VehicleMaster.origin == origin)
        query = query.where(VehicleMaster.is_active == True)
        query = query.order_by(VehicleMaster.manufacturer)
        
        result = await db.execute(query)
        rows = result.all()
        
        # 응답 데이터 구성
        manufacturers = []
        seen = set()
        for manufacturer, origin_val in rows:
            if manufacturer not in seen:
                manufacturers.append({
                    "id": manufacturer,  # 제조사명을 ID로 사용 (UUID 대신)
                    "name": manufacturer,
                    "origin": origin_val
                })
                seen.add(manufacturer)
        
        # Redis에 캐시 저장
        try:
            redis = await get_redis()
            await redis.setex(
                cache_key,
                VehicleService.CACHE_TTL,
                json.dumps(manufacturers, ensure_ascii=False)
            )
        except Exception:
            # Redis 오류는 무시하고 계속 진행
            pass
        
        return manufacturers
    
    @staticmethod
    async def get_model_groups(
        db: AsyncSession,
        manufacturer: str,
        origin: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        모델 그룹 목록 조회 (Redis 캐싱 적용)
        
        Args:
            db: 데이터베이스 세션
            manufacturer: 제조사명
            origin: 국산/수입 구분 (선택적)
        
        Returns:
            모델 그룹 목록
        """
        # 캐시 키 생성
        cache_key = f"vehicles:model_groups:{manufacturer}:{origin or 'all'}"
        
        # Redis에서 캐시 확인
        try:
            redis = await get_redis()
            cached_data = await redis.get(cache_key)
            if cached_data:
                return json.loads(cached_data)
        except Exception:
            pass
        
        # DB에서 조회
        query = select(distinct(VehicleMaster.model_group))
        query = query.where(VehicleMaster.manufacturer == manufacturer)
        query = query.where(VehicleMaster.is_active == True)
        if origin:
            query = query.where(VehicleMaster.origin == origin)
        query = query.order_by(VehicleMaster.model_group)
        
        result = await db.execute(query)
        rows = result.all()
        
        # 응답 데이터 구성
        model_groups = [
            {
                "id": model_group[0],  # 모델 그룹명을 ID로 사용
                "name": model_group[0],
                "manufacturer": manufacturer
            }
            for model_group in rows
        ]
        
        # Redis에 캐시 저장
        try:
            redis = await get_redis()
            await redis.setex(
                cache_key,
                VehicleService.CACHE_TTL,
                json.dumps(model_groups, ensure_ascii=False)
            )
        except Exception:
            pass
        
        return model_groups
    
    @staticmethod
    async def get_models(
        db: AsyncSession,
        manufacturer: Optional[str] = None,
        model_group: Optional[str] = None,
        origin: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        차량 모델 목록 조회 (Redis 캐싱 적용)
        
        Args:
            db: 데이터베이스 세션
            manufacturer: 제조사명 (선택적)
            model_group: 모델 그룹명 (선택적)
            origin: 국산/수입 구분 (선택적)
        
        Returns:
            차량 모델 목록
        """
        # 캐시 키 생성
        cache_key = f"vehicles:models:{manufacturer or 'all'}:{model_group or 'all'}:{origin or 'all'}"
        
        # Redis에서 캐시 확인
        try:
            redis = await get_redis()
            cached_data = await redis.get(cache_key)
            if cached_data:
                return json.loads(cached_data)
        except Exception:
            pass
        
        # DB에서 조회
        query = select(VehicleMaster)
        query = query.where(VehicleMaster.is_active == True)
        
        if manufacturer:
            query = query.where(VehicleMaster.manufacturer == manufacturer)
        if model_group:
            query = query.where(VehicleMaster.model_group == model_group)
        if origin:
            query = query.where(VehicleMaster.origin == origin)
        
        query = query.order_by(VehicleMaster.manufacturer, VehicleMaster.model_group, VehicleMaster.start_year.desc())
        
        result = await db.execute(query)
        vehicles = result.scalars().all()
        
        # 응답 데이터 구성
        models = [
            {
                "id": str(vehicle.id),
                "origin": vehicle.origin,
                "manufacturer": vehicle.manufacturer,
                "model_group": vehicle.model_group,
                "model_detail": vehicle.model_detail,
                "vehicle_class": vehicle.vehicle_class,
                "start_year": vehicle.start_year,
                "end_year": vehicle.end_year,
                "is_active": vehicle.is_active
            }
            for vehicle in vehicles
        ]
        
        # Redis에 캐시 저장
        try:
            redis = await get_redis()
            await redis.setex(
                cache_key,
                VehicleService.CACHE_TTL,
                json.dumps(models, ensure_ascii=False, default=str)
            )
        except Exception:
            pass
        
        return models
    
    @staticmethod
    async def get_model_details(
        db: AsyncSession,
        model_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        차량 모델 상세 정보 조회
        
        Args:
            db: 데이터베이스 세션
            model_id: 모델 ID (UUID)
        
        Returns:
            차량 모델 상세 정보
        """
        query = select(VehicleMaster).where(VehicleMaster.id == model_id)
        result = await db.execute(query)
        vehicle = result.scalar_one_or_none()
        
        if not vehicle:
            return None
        
        return {
            "id": str(vehicle.id),
            "origin": vehicle.origin,
            "manufacturer": vehicle.manufacturer,
            "model_group": vehicle.model_group,
            "model_detail": vehicle.model_detail,
            "vehicle_class": vehicle.vehicle_class,
            "start_year": vehicle.start_year,
            "end_year": vehicle.end_year,
            "is_active": vehicle.is_active,
            "created_at": vehicle.created_at.isoformat() if vehicle.created_at else None,
            "updated_at": vehicle.updated_at.isoformat() if vehicle.updated_at else None
        }
    
    @staticmethod
    async def get_vehicle_classes(
        db: AsyncSession,
        origin: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        차량 등급 목록 조회
        
        Args:
            db: 데이터베이스 세션
            origin: 국산/수입 구분 (선택적)
        
        Returns:
            차량 등급 목록
        """
        # 등급명 매핑
        class_mapping = {
            "compact": "경차",
            "small": "소형",
            "mid": "중형",
            "large": "대형",
            "suv": "SUV",
            "sports": "스포츠카",
            "supercar": "슈퍼카"
        }
        
        query = select(distinct(VehicleMaster.vehicle_class), VehicleMaster.origin)
        query = query.where(VehicleMaster.is_active == True)
        if origin:
            query = query.where(VehicleMaster.origin == origin)
        query = query.order_by(VehicleMaster.vehicle_class)
        
        result = await db.execute(query)
        rows = result.all()
        
        classes = []
        seen = set()
        for vehicle_class, origin_val in rows:
            key = f"{vehicle_class}:{origin_val}"
            if key not in seen:
                classes.append({
                    "class_name": vehicle_class,
                    "display_name": class_mapping.get(vehicle_class, vehicle_class),
                    "origin": origin_val
                })
                seen.add(key)
        
        return classes
    
    @staticmethod
    async def invalidate_cache(pattern: str):
        """
        캐시 무효화
        
        Args:
            pattern: 무효화할 캐시 키 패턴
        """
        try:
            redis = await get_redis()
            keys = await redis.keys(pattern)
            if keys:
                await redis.delete(*keys)
        except Exception:
            pass

