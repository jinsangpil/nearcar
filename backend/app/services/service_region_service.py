"""
서비스 지역 관리 서비스
"""
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc, asc, Integer
from datetime import datetime
import uuid

from app.models.service_region import ServiceRegion
from app.models.inspection import Inspection
from app.services.pricing_service import PricingService
from app.core.redis import get_redis
from loguru import logger


class ServiceRegionService:
    """서비스 지역 관리 서비스"""
    
    @staticmethod
    async def create_service_region(
        db: AsyncSession,
        province: str,
        city: str,
        extra_fee: int,
        is_active: bool = True,
        province_code: Optional[str] = None,
        city_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        서비스 지역 생성
        
        Args:
            db: 데이터베이스 세션
            province: 상위 지역
            city: 하위 지역
            extra_fee: 추가 요금
            is_active: 활성 상태
        
        Returns:
            생성된 서비스 지역 정보
        """
        # 중복 체크 (province + city는 UNIQUE)
        query = select(ServiceRegion).where(
            and_(
                ServiceRegion.province == province,
                ServiceRegion.city == city
            )
        )
        result = await db.execute(query)
        existing = result.scalar_one_or_none()
        
        if existing:
            raise ValueError(f"이미 존재하는 서비스 지역입니다: {province} - {city}")
        
        # 서비스 지역 생성
        service_region = ServiceRegion(
            id=uuid.uuid4(),
            province=province,
            province_code=province_code,
            city=city,
            city_code=city_code,
            extra_fee=extra_fee,
            is_active=is_active
        )
        db.add(service_region)
        await db.commit()
        await db.refresh(service_region)
        
        # Redis 캐시 무효화
        try:
            redis = await get_redis()
            await PricingService.invalidate_cache("quote:*")
            await PricingService.invalidate_cache("regions:*")
            logger.info(f"서비스 지역 생성 후 캐시 무효화 완료: {province}/{city}")
        except Exception as e:
            logger.warning(f"캐시 무효화 실패 (무시): {str(e)}")
        
        return {
            "id": str(service_region.id),
            "province": service_region.province,
            "province_code": service_region.province_code,
            "city": service_region.city,
            "city_code": service_region.city_code,
            "extra_fee": service_region.extra_fee,
            "is_active": service_region.is_active,
            "created_at": service_region.created_at.isoformat(),
            "updated_at": service_region.updated_at.isoformat()
        }
    
    @staticmethod
    async def get_service_region(
        db: AsyncSession,
        region_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        서비스 지역 조회
        
        Args:
            db: 데이터베이스 세션
            region_id: 서비스 지역 ID
        
        Returns:
            서비스 지역 정보
        """
        query = select(ServiceRegion).where(ServiceRegion.id == uuid.UUID(region_id))
        result = await db.execute(query)
        region = result.scalar_one_or_none()
        
        if not region:
            return None
        
        return {
            "id": str(region.id),
            "province": region.province,
            "province_code": region.province_code,
            "city": region.city,
            "city_code": region.city_code,
            "extra_fee": region.extra_fee,
            "is_active": region.is_active,
            "created_at": region.created_at.isoformat(),
            "updated_at": region.updated_at.isoformat()
        }
    
    @staticmethod
    async def list_service_regions(
        db: AsyncSession,
        province: Optional[str] = None,
        city: Optional[str] = None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
        page: int = 1,
        limit: int = 100
    ) -> Dict[str, Any]:
        """
        서비스 지역 목록 조회
        
        Args:
            db: 데이터베이스 세션
            province: 상위 지역 필터
            city: 하위 지역 필터
            is_active: 활성 상태 필터
            search: 검색어 (province, city 부분 일치)
            page: 페이지 번호
            limit: 페이지 크기
        
        Returns:
            서비스 지역 목록 및 페이지네이션 정보
        """
        # 기본 쿼리
        base_query = select(ServiceRegion)
        count_query = select(func.count()).select_from(ServiceRegion)
        
        # 필터 조건
        conditions = []
        if province:
            conditions.append(ServiceRegion.province == province)
        if city:
            conditions.append(ServiceRegion.city == city)
        if is_active is not None:
            conditions.append(ServiceRegion.is_active == is_active)
        
        # 검색 조건
        if search:
            search_condition = or_(
                ServiceRegion.province.ilike(f"%{search}%"),
                ServiceRegion.city.ilike(f"%{search}%")
            )
            conditions.append(search_condition)
        
        if conditions:
            base_query = base_query.where(and_(*conditions))
            count_query = count_query.where(and_(*conditions))
        
        # 총 개수 조회
        count_result = await db.execute(count_query)
        total = count_result.scalar_one()
        
        # 정렬 및 페이지네이션
        base_query = base_query.order_by(
            asc(ServiceRegion.province),
            asc(ServiceRegion.city)
        )
        base_query = base_query.offset((page - 1) * limit).limit(limit)
        
        # 데이터 조회
        result = await db.execute(base_query)
        regions = result.scalars().all()
        
        items = [
                {
                    "id": str(region.id),
                    "province": region.province,
                    "province_code": region.province_code,
                    "city": region.city,
                    "city_code": region.city_code,
                    "extra_fee": region.extra_fee,
                    "is_active": region.is_active,
                    "created_at": region.created_at.isoformat(),
                    "updated_at": region.updated_at.isoformat()
                }
            for region in regions
        ]
        
        total_pages = (total + limit - 1) // limit if total > 0 else 0
        
        return {
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": total_pages
        }
    
    @staticmethod
    async def list_service_regions_hierarchy(
        db: AsyncSession,
        is_active: Optional[bool] = None
    ) -> List[Dict[str, Any]]:
        """
        서비스 지역 계층 구조 조회
        
        Args:
            db: 데이터베이스 세션
            is_active: 활성 상태 필터
        
        Returns:
            province별로 그룹화된 서비스 지역 목록
        """
        # 기본 쿼리
        query = select(ServiceRegion)
        
        # 필터 조건
        if is_active is not None:
            query = query.where(ServiceRegion.is_active == is_active)
        
        # 정렬
        query = query.order_by(
            asc(ServiceRegion.province),
            asc(ServiceRegion.city)
        )
        
        # 데이터 조회
        result = await db.execute(query)
        regions = result.scalars().all()
        
        # province별로 그룹화
        hierarchy: Dict[str, List[Dict[str, Any]]] = {}
        for region in regions:
            province = region.province
            if province not in hierarchy:
                hierarchy[province] = []
            
            hierarchy[province].append({
                "id": str(region.id),
                "province": region.province,
                "province_code": region.province_code,
                "city": region.city,
                "city_code": region.city_code,
                "extra_fee": region.extra_fee,
                "is_active": region.is_active,
                "created_at": region.created_at.isoformat(),
                "updated_at": region.updated_at.isoformat()
            })
        
        # 리스트 형태로 변환
        result_list = [
            {
                "province": province,
                "cities": cities
            }
            for province, cities in hierarchy.items()
        ]
        
        return result_list
    
    @staticmethod
    async def update_service_region(
        db: AsyncSession,
        region_id: str,
        province: Optional[str] = None,
        province_code: Optional[str] = None,
        city: Optional[str] = None,
        city_code: Optional[str] = None,
        extra_fee: Optional[int] = None,
        is_active: Optional[bool] = None
    ) -> Dict[str, Any]:
        """
        서비스 지역 수정
        
        Args:
            db: 데이터베이스 세션
            region_id: 서비스 지역 ID
            province: 상위 지역
            city: 하위 지역
            extra_fee: 추가 요금
            is_active: 활성 상태
        
        Returns:
            수정된 서비스 지역 정보
        """
        query = select(ServiceRegion).where(ServiceRegion.id == uuid.UUID(region_id))
        result = await db.execute(query)
        region = result.scalar_one_or_none()
        
        if not region:
            raise ValueError("서비스 지역을 찾을 수 없습니다")
        
        # province나 city 변경 시 중복 체크
        if province or city:
            new_province = province if province is not None else region.province
            new_city = city if city is not None else region.city
            
            if new_province != region.province or new_city != region.city:
                duplicate_query = select(ServiceRegion).where(
                    and_(
                        ServiceRegion.province == new_province,
                        ServiceRegion.city == new_city,
                        ServiceRegion.id != uuid.UUID(region_id)
                    )
                )
                duplicate_result = await db.execute(duplicate_query)
                duplicate = duplicate_result.scalar_one_or_none()
                
                if duplicate:
                    raise ValueError(f"이미 존재하는 서비스 지역입니다: {new_province} - {new_city}")
        
        # 수정할 필드 업데이트
        if province is not None:
            region.province = province
        if province_code is not None:
            region.province_code = province_code
        if city is not None:
            region.city = city
        if city_code is not None:
            region.city_code = city_code
        if extra_fee is not None:
            region.extra_fee = extra_fee
        if is_active is not None:
            region.is_active = is_active
        
        await db.commit()
        await db.refresh(region)
        
        # Redis 캐시 무효화
        try:
            redis = await get_redis()
            await PricingService.invalidate_cache("quote:*")
            await PricingService.invalidate_cache("regions:*")
            logger.info(f"서비스 지역 수정 후 캐시 무효화 완료: {region.province}/{region.city}")
        except Exception as e:
            logger.warning(f"캐시 무효화 실패 (무시): {str(e)}")
        
        return {
            "id": str(region.id),
            "province": region.province,
            "province_code": region.province_code,
            "city": region.city,
            "city_code": region.city_code,
            "extra_fee": region.extra_fee,
            "is_active": region.is_active,
            "created_at": region.created_at.isoformat(),
            "updated_at": region.updated_at.isoformat()
        }
    
    @staticmethod
    async def delete_service_region(
        db: AsyncSession,
        region_id: str
    ) -> bool:
        """
        서비스 지역 삭제
        
        Args:
            db: 데이터베이스 세션
            region_id: 서비스 지역 ID
        
        Returns:
            삭제 성공 여부
        """
        query = select(ServiceRegion).where(ServiceRegion.id == uuid.UUID(region_id))
        result = await db.execute(query)
        region = result.scalar_one_or_none()
        
        if not region:
            raise ValueError("서비스 지역을 찾을 수 없습니다")
        
        # 활성 신청 건 체크
        # Inspection 테이블에서 location_address에 해당 지역이 포함된 활성 신청 건 확인
        # 주소 문자열 검색으로 확인 (정확한 매칭은 어려우므로 주의)
        # 실제로는 region_id를 직접 참조하는 필드가 없으므로, 
        # location_address에 province나 city가 포함된 경우를 체크
        active_statuses = ['requested', 'paid', 'assigned', 'in_progress']
        active_query = select(func.count()).select_from(Inspection).where(
            and_(
                Inspection.status.in_(active_statuses),
                or_(
                    Inspection.location_address.ilike(f"%{region.province}%"),
                    Inspection.location_address.ilike(f"%{region.city}%")
                )
            )
        )
        active_result = await db.execute(active_query)
        active_count = active_result.scalar_one()
        
        if active_count > 0:
            raise ValueError(f"활성 신청 건이 {active_count}건 있어 삭제할 수 없습니다")
        
        province = region.province
        city = region.city
        
        await db.delete(region)
        await db.commit()
        
        # Redis 캐시 무효화
        try:
            redis = await get_redis()
            await PricingService.invalidate_cache("quote:*")
            await PricingService.invalidate_cache("regions:*")
            logger.info(f"서비스 지역 삭제 후 캐시 무효화 완료: {province}/{city}")
        except Exception as e:
            logger.warning(f"캐시 무효화 실패 (무시): {str(e)}")
        
        return True

    @staticmethod
    async def bulk_update_province_regions(
        db: AsyncSession,
        province_code: str,
        is_active: bool
    ) -> Dict[str, Any]:
        """
        광역시도 코드로 해당 지역의 모든 시군구를 일괄 활성/비활성화
        
        Args:
            db: 데이터베이스 세션
            province_code: 광역시도 코드 (11, 21, 22 등)
            is_active: 활성화 여부
        
        Returns:
            업데이트된 지역 수 및 결과
        """
        # 해당 광역시도 코드로 필터링
        query = select(ServiceRegion).where(
            ServiceRegion.province_code == province_code
        )
        result = await db.execute(query)
        regions = result.scalars().all()
        
        if not regions:
            # 해당 광역시도의 시군구가 없으면 생성
            from app.services.public_data_service import PublicDataService
            cities = await PublicDataService.get_cities_by_province(province_code)
            
            if not cities:
                raise ValueError(f"광역시도 코드 {province_code}에 해당하는 시군구 정보를 찾을 수 없습니다.")
            
            # 광역시도 이름 가져오기
            province_name = None
            for p in await PublicDataService.get_all_provinces():
                if p["code"] == province_code:
                    province_name = p["name"]
                    break
            
            if not province_name:
                raise ValueError(f"광역시도 코드 {province_code}에 해당하는 이름을 찾을 수 없습니다.")
            
            # 모든 시군구 생성
            created_count = 0
            for city in cities:
                # 중복 체크
                existing_query = select(ServiceRegion).where(
                    and_(
                        ServiceRegion.province == province_name,
                        ServiceRegion.city == city["name"]
                    )
                )
                existing_result = await db.execute(existing_query)
                existing = existing_result.scalar_one_or_none()
                
                if not existing:
                    service_region = ServiceRegion(
                        id=uuid.uuid4(),
                        province=province_name,
                        province_code=province_code,
                        city=city["name"],
                        city_code=city["code"],
                        extra_fee=0,
                        is_active=is_active
                    )
                    db.add(service_region)
                    created_count += 1
            
            await db.commit()
            
            # 생성 후 다시 조회
            query = select(ServiceRegion).where(
                ServiceRegion.province_code == province_code
            )
            result = await db.execute(query)
            regions = result.scalars().all()
        
        # 일괄 업데이트
        updated_count = 0
        for region in regions:
            if region.is_active != is_active:
                region.is_active = is_active
                updated_count += 1
        
        await db.commit()
        
        # 캐시 무효화
        await ServiceRegionService._invalidate_caches()
        
        return {
            "province_code": province_code,
            "is_active": is_active,
            "total_regions": len(regions),
            "updated_count": updated_count
        }
    
    @staticmethod
    async def get_province_status(
        db: AsyncSession,
        province_code: str
    ) -> Dict[str, Any]:
        """
        광역시도별 활성 지역 수 조회
        
        Args:
            db: 데이터베이스 세션
            province_code: 광역시도 코드
        
        Returns:
            활성/비활성 지역 수 정보
        """
        query = select(
            func.count().label("total"),
            func.sum(func.cast(ServiceRegion.is_active, Integer)).label("active_count")
        ).where(
            ServiceRegion.province_code == province_code
        )
        result = await db.execute(query)
        row = result.first()
        
        total = row.total or 0
        active_count = row.active_count or 0
        
        return {
            "province_code": province_code,
            "total": total,
            "active_count": active_count,
            "inactive_count": total - active_count,
            "is_fully_active": total > 0 and active_count == total,
            "is_partially_active": total > 0 and active_count > 0 and active_count < total
        }
    
    @staticmethod
    async def _invalidate_caches():
        """
        서비스 지역 관련 캐시를 무효화합니다.
        """
        try:
            redis = await get_redis()
            await PricingService.invalidate_cache("quote:*")
            await redis.delete("regions:list")
            await redis.delete("regions:hierarchy:True")
            await redis.delete("regions:hierarchy:False")
            logger.info("서비스 지역 관련 캐시 무효화 완료")
        except Exception as e:
            logger.warning(f"캐시 무효화 실패 (무시): {str(e)}")

