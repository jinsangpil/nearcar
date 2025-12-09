"""
차량 마스터 관리 서비스
"""
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc, asc
from datetime import datetime, timezone
import uuid
import json

from app.models.vehicle_master import VehicleMaster
from app.core.redis import get_redis
from loguru import logger


class VehicleMasterService:
    """차량 마스터 관리 서비스"""
    
    CACHE_PREFIX = "vehicles:"
    
    @staticmethod
    async def create_vehicle_master(
        db: AsyncSession,
        origin: str,
        manufacturer: str,
        model_group: str,
        model_detail: Optional[str],
        vehicle_class: str,
        start_year: int,
        end_year: Optional[int],
        is_active: bool = True
    ) -> VehicleMaster:
        """
        차량 마스터 생성
        
        Args:
            db: 데이터베이스 세션
            origin: 국산/수입
            manufacturer: 제조사
            model_group: 모델 그룹
            model_detail: 모델 상세
            vehicle_class: 차량 등급
            start_year: 출시 시작 연도
            end_year: 출시 종료 연도
            is_active: 활성화 여부
        
        Returns:
            생성된 VehicleMaster 객체
        """
        # 중복 확인
        query = select(VehicleMaster).where(
            and_(
                VehicleMaster.origin == origin,
                VehicleMaster.manufacturer == manufacturer,
                VehicleMaster.model_group == model_group,
                VehicleMaster.model_detail == model_detail
            )
        )
        result = await db.execute(query)
        existing = result.scalar_one_or_none()
        
        if existing:
            raise ValueError(f"이미 존재하는 차량 마스터입니다: {manufacturer} {model_group} {model_detail or ''}")
        
        new_master = VehicleMaster(
            origin=origin,
            manufacturer=manufacturer,
            model_group=model_group,
            model_detail=model_detail,
            vehicle_class=vehicle_class,
            start_year=start_year,
            end_year=end_year,
            is_active=is_active
        )
        db.add(new_master)
        await db.commit()
        await db.refresh(new_master)
        
        # 캐시 무효화
        await VehicleMasterService.invalidate_cache()
        
        return new_master
    
    @staticmethod
    async def get_vehicle_master(
        db: AsyncSession,
        master_id: uuid.UUID
    ) -> Optional[VehicleMaster]:
        """
        차량 마스터 조회
        
        Args:
            db: 데이터베이스 세션
            master_id: 차량 마스터 ID
        
        Returns:
            VehicleMaster 객체 또는 None
        """
        query = select(VehicleMaster).where(VehicleMaster.id == master_id)
        result = await db.execute(query)
        return result.scalar_one_or_none()
    
    @staticmethod
    async def update_vehicle_master(
        db: AsyncSession,
        master_id: uuid.UUID,
        origin: Optional[str] = None,
        manufacturer: Optional[str] = None,
        model_group: Optional[str] = None,
        model_detail: Optional[str] = None,
        vehicle_class: Optional[str] = None,
        start_year: Optional[int] = None,
        end_year: Optional[int] = None,
        is_active: Optional[bool] = None
    ) -> Optional[VehicleMaster]:
        """
        차량 마스터 수정
        
        Args:
            db: 데이터베이스 세션
            master_id: 차량 마스터 ID
            origin: 국산/수입
            manufacturer: 제조사
            model_group: 모델 그룹
            model_detail: 모델 상세
            vehicle_class: 차량 등급
            start_year: 출시 시작 연도
            end_year: 출시 종료 연도
            is_active: 활성화 여부
        
        Returns:
            수정된 VehicleMaster 객체 또는 None
        """
        master = await VehicleMasterService.get_vehicle_master(db, master_id)
        if not master:
            return None
        
        # 수정할 필드 업데이트
        if origin is not None:
            master.origin = origin
        if manufacturer is not None:
            master.manufacturer = manufacturer
        if model_group is not None:
            master.model_group = model_group
        if model_detail is not None:
            master.model_detail = model_detail
        if vehicle_class is not None:
            master.vehicle_class = vehicle_class
        if start_year is not None:
            master.start_year = start_year
        if end_year is not None:
            master.end_year = end_year
        if is_active is not None:
            master.is_active = is_active
        
        master.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(master)
        
        # 캐시 무효화
        await VehicleMasterService.invalidate_cache()
        
        return master
    
    @staticmethod
    async def delete_vehicle_master(
        db: AsyncSession,
        master_id: uuid.UUID
    ) -> bool:
        """
        차량 마스터 삭제 (soft delete)
        
        Args:
            db: 데이터베이스 세션
            master_id: 차량 마스터 ID
        
        Returns:
            삭제 성공 여부
        """
        master = await VehicleMasterService.get_vehicle_master(db, master_id)
        if not master:
            return False
        
        # 활성 신청 건이 있는지 확인 (나중에 구현)
        # 현재는 바로 삭제
        
        master.is_active = False
        master.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(master)
        
        # 캐시 무효화
        await VehicleMasterService.invalidate_cache()
        
        return True
    
    @staticmethod
    async def list_vehicle_masters(
        db: AsyncSession,
        origin: Optional[str] = None,
        manufacturer: Optional[str] = None,
        vehicle_class: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        limit: int = 20
    ) -> Dict[str, Any]:
        """
        차량 마스터 목록 조회
        
        Args:
            db: 데이터베이스 세션
            origin: 국산/수입 필터
            manufacturer: 제조사 필터
            vehicle_class: 차량 등급 필터
            search: 검색어 (제조사, 모델명)
            page: 페이지 번호
            limit: 페이지 크기
        
        Returns:
            차량 마스터 목록 및 페이지네이션 정보
        """
        query = select(VehicleMaster)
        count_query = select(func.count(VehicleMaster.id))
        
        # 필터링 조건
        conditions = []
        if origin:
            conditions.append(VehicleMaster.origin == origin)
        if manufacturer:
            conditions.append(VehicleMaster.manufacturer == manufacturer)
        if vehicle_class:
            conditions.append(VehicleMaster.vehicle_class == vehicle_class)
        if search:
            search_condition = or_(
                VehicleMaster.manufacturer.ilike(f"%{search}%"),
                VehicleMaster.model_group.ilike(f"%{search}%"),
                VehicleMaster.model_detail.ilike(f"%{search}%")
            )
            conditions.append(search_condition)
        
        if conditions:
            query = query.where(and_(*conditions))
            count_query = count_query.where(and_(*conditions))
        
        # 총 개수 조회
        total_count_result = await db.execute(count_query)
        total_count = total_count_result.scalar_one()
        
        # 페이지네이션
        query = query.order_by(
            VehicleMaster.manufacturer,
            VehicleMaster.model_group,
            VehicleMaster.start_year.desc()
        ).offset((page - 1) * limit).limit(limit)
        
        result = await db.execute(query)
        masters = result.scalars().all()
        
        master_list = [
            {
                "id": str(master.id),
                "origin": master.origin,
                "manufacturer": master.manufacturer,
                "model_group": master.model_group,
                "model_detail": master.model_detail,
                "vehicle_class": master.vehicle_class,
                "start_year": master.start_year,
                "end_year": master.end_year,
                "is_active": master.is_active,
                "created_at": master.created_at.isoformat() if master.created_at else None,
                "updated_at": master.updated_at.isoformat() if master.updated_at else None,
            }
            for master in masters
        ]
        
        return {
            "items": master_list,
            "total": total_count,
            "page": page,
            "limit": limit,
            "total_pages": (total_count + limit - 1) // limit,
        }
    
    @staticmethod
    async def sync_vehicle_masters(
        db: AsyncSession,
        data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        차량 마스터 일괄 동기화
        
        Args:
            db: 데이터베이스 세션
            data: 동기화할 차량 마스터 데이터 목록
        
        Returns:
            동기화 결과 (생성/업데이트/실패 건수)
        """
        created_count = 0
        updated_count = 0
        failed_count = 0
        errors = []
        
        for item in data:
            try:
                # 기존 레코드 확인
                query = select(VehicleMaster).where(
                    and_(
                        VehicleMaster.origin == item["origin"],
                        VehicleMaster.manufacturer == item["manufacturer"],
                        VehicleMaster.model_group == item["model_group"],
                        VehicleMaster.model_detail == item.get("model_detail")
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
                    new_master = VehicleMaster(
                        origin=item["origin"],
                        manufacturer=item["manufacturer"],
                        model_group=item["model_group"],
                        model_detail=item.get("model_detail"),
                        vehicle_class=item["vehicle_class"],
                        start_year=item["start_year"],
                        end_year=item.get("end_year"),
                        is_active=item.get("is_active", True)
                    )
                    db.add(new_master)
                    created_count += 1
            except Exception as e:
                failed_count += 1
                errors.append(f"{item.get('manufacturer', 'Unknown')} {item.get('model_group', 'Unknown')}: {str(e)}")
                logger.error(f"차량 마스터 동기화 실패: {str(e)}")
        
        await db.commit()
        
        # 캐시 무효화
        await VehicleMasterService.invalidate_cache()
        
        return {
            "created": created_count,
            "updated": updated_count,
            "failed": failed_count,
            "errors": errors
        }
    
    @staticmethod
    async def invalidate_cache():
        """차량 마스터 관련 캐시 무효화"""
        try:
            redis = await get_redis()
            # 모든 차량 관련 캐시 키 삭제
            pattern = f"{VehicleMasterService.CACHE_PREFIX}*"
            keys = await redis.keys(pattern)
            if keys:
                await redis.delete(*keys)
            logger.info(f"차량 마스터 캐시 무효화 완료: {len(keys)}개 키 삭제")
        except Exception as e:
            logger.error(f"캐시 무효화 실패: {str(e)}")

