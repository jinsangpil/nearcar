"""
기사 활동 지역 관리 서비스
"""
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
import uuid

from app.models.inspector_region import InspectorRegion
from app.models.service_region import ServiceRegion
from loguru import logger


class InspectorRegionService:
    """기사 활동 지역 관리 서비스"""
    
    @staticmethod
    async def create_inspector_regions(
        db: AsyncSession,
        user_id: str,
        region_ids: List[str]
    ) -> List[InspectorRegion]:
        """
        기사의 활동 지역 생성 (다중)
        
        Args:
            db: 데이터베이스 세션
            user_id: 기사 ID
            region_id: 활동 지역 ID 목록
        
        Returns:
            생성된 InspectorRegion 목록
        """
        if not region_ids:
            return []
        
        # 중복 제거
        unique_region_ids = list(set(region_ids))
        
        # 기존 지역 삭제
        await InspectorRegionService.delete_inspector_regions(db, user_id)
        
        # 새 지역 생성
        inspector_regions = []
        for region_id_str in unique_region_ids:
            try:
                region_uuid = uuid.UUID(region_id_str)
                
                # ServiceRegion 존재 확인
                result = await db.execute(
                    select(ServiceRegion).where(ServiceRegion.id == region_uuid)
                )
                region = result.scalar_one_or_none()
                if not region:
                    logger.warning(f"존재하지 않는 지역 ID: {region_id_str}")
                    continue
                
                inspector_region = InspectorRegion(
                    user_id=uuid.UUID(user_id),
                    region_id=region_uuid
                )
                db.add(inspector_region)
                inspector_regions.append(inspector_region)
            except (ValueError, AttributeError) as e:
                logger.warning(f"유효하지 않은 지역 ID 형식: {region_id_str}, {e}")
                continue
        
        await db.commit()
        
        # 생성된 레코드 새로고침
        for ir in inspector_regions:
            await db.refresh(ir)
        
        logger.info(f"기사 활동 지역 생성: user_id={user_id}, regions={len(inspector_regions)}")
        
        return inspector_regions
    
    @staticmethod
    async def get_inspector_regions(
        db: AsyncSession,
        user_id: str
    ) -> List[str]:
        """
        기사의 활동 지역 ID 목록 조회
        
        Args:
            db: 데이터베이스 세션
            user_id: 기사 ID
        
        Returns:
            활동 지역 ID 목록 (UUID 문자열)
        """
        result = await db.execute(
            select(InspectorRegion)
            .where(InspectorRegion.user_id == uuid.UUID(user_id))
        )
        inspector_regions = result.scalars().all()
        
        return [str(ir.region_id) for ir in inspector_regions]
    
    @staticmethod
    async def get_inspector_regions_with_details(
        db: AsyncSession,
        user_id: str
    ) -> List[dict]:
        """
        기사의 활동 지역 상세 정보 조회
        
        Args:
            db: 데이터베이스 세션
            user_id: 기사 ID
        
        Returns:
            활동 지역 상세 정보 목록
        """
        result = await db.execute(
            select(InspectorRegion)
            .options(selectinload(InspectorRegion.region))
            .where(InspectorRegion.user_id == uuid.UUID(user_id))
        )
        inspector_regions = result.scalars().all()
        
        regions = []
        for ir in inspector_regions:
            if ir.region:
                regions.append({
                    "id": str(ir.region_id),
                    "province": ir.region.province,
                    "city": ir.region.city,
                    "extra_fee": ir.region.extra_fee,
                    "is_active": ir.region.is_active
                })
        
        return regions
    
    @staticmethod
    async def update_inspector_regions(
        db: AsyncSession,
        user_id: str,
        region_ids: List[str]
    ) -> List[InspectorRegion]:
        """
        기사의 활동 지역 업데이트 (전체 교체)
        
        Args:
            db: 데이터베이스 세션
            user_id: 기사 ID
            region_ids: 새 활동 지역 ID 목록
        
        Returns:
            업데이트된 InspectorRegion 목록
        """
        return await InspectorRegionService.create_inspector_regions(db, user_id, region_ids)
    
    @staticmethod
    async def delete_inspector_regions(
        db: AsyncSession,
        user_id: str
    ) -> int:
        """
        기사의 모든 활동 지역 삭제
        
        Args:
            db: 데이터베이스 세션
            user_id: 기사 ID
        
        Returns:
            삭제된 레코드 수
        """
        result = await db.execute(
            delete(InspectorRegion)
            .where(InspectorRegion.user_id == uuid.UUID(user_id))
        )
        await db.commit()
        
        deleted_count = result.rowcount
        logger.info(f"기사 활동 지역 삭제: user_id={user_id}, count={deleted_count}")
        
        return deleted_count

