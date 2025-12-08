"""
패키지 관리 서비스
"""
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime
import uuid
import json

from app.models.package import Package
from app.models.inspection import Inspection
from app.core.redis import get_redis
from loguru import logger


class PackageService:
    """패키지 관리 서비스"""
    
    @staticmethod
    async def create_package(
        db: AsyncSession,
        name: str,
        base_price: int,
        included_items: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        패키지 생성
        
        Args:
            db: 데이터베이스 세션
            name: 패키지 이름
            base_price: 기본 가격
            included_items: 포함 항목 (JSONB)
        
        Returns:
            생성된 패키지 정보
        """
        # 이름 중복 체크
        result = await db.execute(
            select(Package).where(Package.name == name)
        )
        existing = result.scalar_one_or_none()
        if existing:
            raise ValueError("이미 사용 중인 패키지 이름입니다")
        
        # 패키지 생성
        package = Package(
            id=uuid.uuid4(),
            name=name,
            base_price=base_price,
            included_items=included_items,
            is_active=True
        )
        
        db.add(package)
        await db.commit()
        await db.refresh(package)
        
        logger.info(f"패키지 생성: {package.id} ({name})")
        
        # 캐시 무효화
        await PackageService._invalidate_cache()
        
        return {
            "id": str(package.id),
            "name": package.name,
            "base_price": package.base_price,
            "included_items": package.included_items,
            "is_active": package.is_active,
            "created_at": package.created_at.isoformat() if package.created_at else None,
            "updated_at": package.updated_at.isoformat() if package.updated_at else None
        }
    
    @staticmethod
    async def get_package(
        db: AsyncSession,
        package_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        패키지 상세 조회
        
        Args:
            db: 데이터베이스 세션
            package_id: 패키지 ID
        
        Returns:
            패키지 정보 (없으면 None)
        """
        result = await db.execute(
            select(Package).where(Package.id == uuid.UUID(package_id))
        )
        package = result.scalar_one_or_none()
        
        if not package:
            return None
        
        return {
            "id": str(package.id),
            "name": package.name,
            "base_price": package.base_price,
            "included_items": package.included_items,
            "is_active": package.is_active,
            "created_at": package.created_at.isoformat() if package.created_at else None,
            "updated_at": package.updated_at.isoformat() if package.updated_at else None
        }
    
    @staticmethod
    async def update_package(
        db: AsyncSession,
        package_id: str,
        name: Optional[str] = None,
        base_price: Optional[int] = None,
        included_items: Optional[Dict[str, Any]] = None,
        is_active: Optional[bool] = None
    ) -> Dict[str, Any]:
        """
        패키지 수정
        
        Args:
            db: 데이터베이스 세션
            package_id: 패키지 ID
            name: 패키지 이름
            base_price: 기본 가격
            included_items: 포함 항목
            is_active: 활성화 여부
        
        Returns:
            수정된 패키지 정보
        """
        result = await db.execute(
            select(Package).where(Package.id == uuid.UUID(package_id))
        )
        package = result.scalar_one_or_none()
        
        if not package:
            raise ValueError("패키지를 찾을 수 없습니다")
        
        # 이름 중복 체크 (다른 패키지가 사용 중인지)
        if name and name != package.name:
            result = await db.execute(
                select(Package).where(Package.name == name)
            )
            existing = result.scalar_one_or_none()
            if existing:
                raise ValueError("이미 사용 중인 패키지 이름입니다")
        
        # 필드 업데이트
        if name is not None:
            package.name = name
        if base_price is not None:
            package.base_price = base_price
        if included_items is not None:
            package.included_items = included_items
        if is_active is not None:
            package.is_active = is_active
        
        await db.commit()
        await db.refresh(package)
        
        logger.info(f"패키지 수정: {package.id} ({package.name})")
        
        # 캐시 무효화
        await PackageService._invalidate_cache()
        
        return {
            "id": str(package.id),
            "name": package.name,
            "base_price": package.base_price,
            "included_items": package.included_items,
            "is_active": package.is_active,
            "created_at": package.created_at.isoformat() if package.created_at else None,
            "updated_at": package.updated_at.isoformat() if package.updated_at else None
        }
    
    @staticmethod
    async def delete_package(
        db: AsyncSession,
        package_id: str
    ) -> Dict[str, Any]:
        """
        패키지 삭제 (Soft Delete)
        
        활성 신청 건이 있으면 삭제 불가
        
        Args:
            db: 데이터베이스 세션
            package_id: 패키지 ID
        
        Returns:
            삭제된 패키지 정보
        """
        result = await db.execute(
            select(Package).where(Package.id == uuid.UUID(package_id))
        )
        package = result.scalar_one_or_none()
        
        if not package:
            raise ValueError("패키지를 찾을 수 없습니다")
        
        # 활성 신청 건 체크
        inspection_result = await db.execute(
            select(func.count()).select_from(Inspection).where(
                and_(
                    Inspection.package_id == uuid.UUID(package_id),
                    Inspection.status.in_(["requested", "assigned", "in_progress"])
                )
            )
        )
        active_count = inspection_result.scalar()
        
        if active_count > 0:
            raise ValueError(f"활성 신청 건이 {active_count}건 있어 삭제할 수 없습니다")
        
        # Soft Delete: is_active를 False로 변경
        package.is_active = False
        
        await db.commit()
        await db.refresh(package)
        
        logger.info(f"패키지 삭제 (Soft Delete): {package.id} ({package.name})")
        
        # 캐시 무효화
        await PackageService._invalidate_cache()
        
        return {
            "id": str(package.id),
            "is_active": package.is_active
        }
    
    @staticmethod
    async def list_packages(
        db: AsyncSession,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
        page: int = 1,
        limit: int = 20
    ) -> Dict[str, Any]:
        """
        패키지 목록 조회
        
        Args:
            db: 데이터베이스 세션
            search: 검색어 (패키지 이름)
            is_active: 활성화 여부 필터
            page: 페이지 번호
            limit: 페이지 크기
        
        Returns:
            패키지 목록 및 페이지네이션 정보
        """
        # 기본 쿼리
        query = select(Package)
        conditions = []
        
        # 필터링
        if is_active is not None:
            conditions.append(Package.is_active == is_active)
        
        # 검색
        if search:
            conditions.append(Package.name.ilike(f"%{search}%"))
        
        if conditions:
            query = query.where(and_(*conditions))
        
        # 총 개수 조회
        count_query = select(func.count()).select_from(Package)
        if conditions:
            count_query = count_query.where(and_(*conditions))
        total_result = await db.execute(count_query)
        total = total_result.scalar()
        
        # 페이지네이션
        offset = (page - 1) * limit
        query = query.offset(offset).limit(limit)
        
        # 정렬 (이름순)
        query = query.order_by(Package.name)
        
        # 실행
        result = await db.execute(query)
        packages = result.scalars().all()
        
        # 응답 데이터 구성
        items = [
            {
                "id": str(pkg.id),
                "name": pkg.name,
                "base_price": pkg.base_price,
                "included_items": pkg.included_items,
                "is_active": pkg.is_active,
                "created_at": pkg.created_at.isoformat() if pkg.created_at else None,
                "updated_at": pkg.updated_at.isoformat() if pkg.updated_at else None
            }
            for pkg in packages
        ]
        
        total_pages = (total + limit - 1) // limit if limit > 0 else 0
        
        return {
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": total_pages
        }
    
    @staticmethod
    async def _invalidate_cache():
        """패키지 관련 캐시 무효화"""
        try:
            redis = await get_redis()
            # 패키지 목록 캐시 무효화
            await redis.delete("packages:list")
            # 견적 캐시도 무효화 (패키지 가격 변경 시)
            keys = await redis.keys("quote:calculate:*")
            if keys:
                await redis.delete(*keys)
        except Exception as e:
            logger.warning(f"캐시 무효화 실패: {str(e)}")

