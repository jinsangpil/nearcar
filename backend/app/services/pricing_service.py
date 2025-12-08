"""
가격 계산 서비스
견적 산출 및 가격 정책 관리
"""
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json
import math

from app.models.package import Package
from app.models.service_region import ServiceRegion
from app.models.vehicle_master import VehicleMaster
from app.models.price_policy import PricePolicy
from app.core.redis import get_redis


class PricingService:
    """가격 계산 서비스"""
    
    QUOTE_CACHE_TTL = 600  # 10분
    LIST_CACHE_TTL = 3600  # 1시간
    
    @staticmethod
    async def calculate_quote(
        db: AsyncSession,
        vehicle_master_id: str,
        package_id: str,
        region_id: str
    ) -> Dict[str, Any]:
        """
        견적 계산
        
        Args:
            db: 데이터베이스 세션
            vehicle_master_id: 차량 마스터 ID
            package_id: 패키지 ID
            region_id: 서비스 지역 ID
        
        Returns:
            견적 계산 결과 딕셔너리
        """
        # 캐시 키 생성
        cache_key = f"quote:calculate:{vehicle_master_id}:{package_id}:{region_id}"
        
        # Redis에서 캐시 확인
        try:
            redis = await get_redis()
            cached_data = await redis.get(cache_key)
            if cached_data:
                return json.loads(cached_data)
        except Exception:
            pass
        
        # 1. 차량 마스터 데이터 조회
        # UUID 문자열을 UUID 객체로 변환 (필요시)
        from uuid import UUID as UUIDType
        try:
            vehicle_master_uuid = UUIDType(vehicle_master_id) if isinstance(vehicle_master_id, str) else vehicle_master_id
        except (ValueError, AttributeError):
            vehicle_master_uuid = vehicle_master_id
        
        vehicle_result = await db.execute(
            select(VehicleMaster).where(VehicleMaster.id == vehicle_master_uuid)
        )
        vehicle_master = vehicle_result.scalar_one_or_none()
        
        if not vehicle_master:
            raise ValueError("차량 마스터 데이터를 찾을 수 없습니다")
        
        if not vehicle_master.is_active:
            raise ValueError("비활성화된 차량 모델입니다")
        
        # 2. 패키지 기본 가격 조회
        # UUID 문자열을 UUID 객체로 변환 (필요시)
        try:
            package_uuid = UUIDType(package_id) if isinstance(package_id, str) else package_id
        except (ValueError, AttributeError):
            package_uuid = package_id
        
        package_result = await db.execute(
            select(Package).where(Package.id == package_uuid)
        )
        package = package_result.scalar_one_or_none()
        
        if not package:
            raise ValueError("패키지를 찾을 수 없습니다")
        
        if not package.is_active:
            raise ValueError("비활성화된 패키지입니다")
        
        base_price = package.base_price
        
        # 3. 차량 등급별 할증 조회
        price_policy_result = await db.execute(
            select(PricePolicy).where(
                PricePolicy.origin == vehicle_master.origin,
                PricePolicy.vehicle_class == vehicle_master.vehicle_class
            )
        )
        price_policy = price_policy_result.scalar_one_or_none()
        
        class_surcharge = price_policy.add_amount if price_policy else 0
        
        # 4. 지역별 출장비 조회
        # UUID 문자열을 UUID 객체로 변환 (필요시)
        try:
            region_uuid = UUIDType(region_id) if isinstance(region_id, str) else region_id
        except (ValueError, AttributeError):
            region_uuid = region_id
        
        region_result = await db.execute(
            select(ServiceRegion).where(ServiceRegion.id == region_uuid)
        )
        region = region_result.scalar_one_or_none()
        
        if not region:
            raise ValueError("서비스 지역을 찾을 수 없습니다")
        
        if not region.is_active:
            raise ValueError("비활성화된 서비스 지역입니다")
        
        region_fee = region.extra_fee
        
        # 5. 총액 계산
        total_amount = base_price + class_surcharge + region_fee
        
        # 6. 10원 단위 반올림
        total_amount = int(math.ceil(total_amount / 10) * 10)
        
        # 응답 데이터 구성
        result = {
            "base_price": base_price,
            "class_surcharge": class_surcharge,
            "region_fee": region_fee,
            "total_amount": total_amount,
            "vehicle_class": vehicle_master.vehicle_class,
            "origin": vehicle_master.origin
        }
        
        # Redis에 캐시 저장
        try:
            redis = await get_redis()
            await redis.setex(
                cache_key,
                PricingService.QUOTE_CACHE_TTL,
                json.dumps(result, ensure_ascii=False)
            )
        except Exception:
            pass
        
        return result
    
    @staticmethod
    async def get_packages(
        db: AsyncSession
    ) -> List[Dict[str, Any]]:
        """
        패키지 목록 조회 (Redis 캐싱 적용)
        
        Args:
            db: 데이터베이스 세션
        
        Returns:
            패키지 목록
        """
        cache_key = "packages:list"
        
        # Redis에서 캐시 확인
        try:
            redis = await get_redis()
            cached_data = await redis.get(cache_key)
            if cached_data:
                return json.loads(cached_data)
        except Exception:
            pass
        
        # DB에서 조회
        query = select(Package).where(Package.is_active == True)
        query = query.order_by(Package.name)
        
        result = await db.execute(query)
        packages = result.scalars().all()
        
        # 응답 데이터 구성
        package_list = [
            {
                "id": str(pkg.id),
                "name": pkg.name,
                "base_price": pkg.base_price,
                "included_items": pkg.included_items,
                "is_active": pkg.is_active
            }
            for pkg in packages
        ]
        
        # Redis에 캐시 저장
        try:
            redis = await get_redis()
            await redis.setex(
                cache_key,
                PricingService.LIST_CACHE_TTL,
                json.dumps(package_list, ensure_ascii=False, default=str)
            )
        except Exception:
            pass
        
        return package_list
    
    @staticmethod
    async def get_regions(
        db: AsyncSession
    ) -> List[Dict[str, Any]]:
        """
        서비스 지역 목록 조회 (계층형 구조, Redis 캐싱 적용)
        
        Args:
            db: 데이터베이스 세션
        
        Returns:
            계층형 지역 목록 (province → cities)
        """
        cache_key = "regions:list"
        
        # Redis에서 캐시 확인
        try:
            redis = await get_redis()
            cached_data = await redis.get(cache_key)
            if cached_data:
                return json.loads(cached_data)
        except Exception:
            pass
        
        # DB에서 조회
        query = select(ServiceRegion).where(ServiceRegion.is_active == True)
        query = query.order_by(ServiceRegion.province, ServiceRegion.city)
        
        result = await db.execute(query)
        regions = result.scalars().all()
        
        # 계층형 구조로 변환
        region_dict = {}
        for region in regions:
            if region.province not in region_dict:
                region_dict[region.province] = []
            
            region_dict[region.province].append({
                "id": str(region.id),
                "city": region.city,
                "extra_fee": region.extra_fee,
                "is_active": region.is_active
            })
        
        # 응답 데이터 구성
        region_list = [
            {
                "province": province,
                "cities": cities
            }
            for province, cities in region_dict.items()
        ]
        
        # Redis에 캐시 저장
        try:
            redis = await get_redis()
            await redis.setex(
                cache_key,
                PricingService.LIST_CACHE_TTL,
                json.dumps(region_list, ensure_ascii=False, default=str)
            )
        except Exception:
            pass
        
        return region_list
    
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

