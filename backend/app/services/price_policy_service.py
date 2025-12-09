"""
가격 정책 관리 서비스
"""
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, desc, asc
from datetime import datetime
import uuid

from app.models.price_policy import PricePolicy
from app.services.pricing_service import PricingService
from app.core.redis import get_redis
from loguru import logger


class PricePolicyService:
    """가격 정책 관리 서비스"""
    
    # 차량 등급 한글명 매핑
    VEHICLE_CLASS_NAMES = {
        'compact': '경차',
        'small': '소형',
        'mid': '중형',
        'large': '대형',
        'suv': 'SUV',
        'sports': '스포츠',
        'supercar': '슈퍼카'
    }
    
    # 국산/수입 한글명 매핑
    ORIGIN_NAMES = {
        'domestic': '국산',
        'imported': '수입'
    }
    
    @staticmethod
    async def create_price_policy(
        db: AsyncSession,
        origin: str,
        vehicle_class: str,
        add_amount: int
    ) -> Dict[str, Any]:
        """
        가격 정책 생성
        
        Args:
            db: 데이터베이스 세션
            origin: 국산/수입
            vehicle_class: 차량 등급
            add_amount: 추가 금액
        
        Returns:
            생성된 가격 정책 정보
        """
        # 중복 체크 (origin + vehicle_class는 UNIQUE)
        query = select(PricePolicy).where(
            and_(
                PricePolicy.origin == origin,
                PricePolicy.vehicle_class == vehicle_class
            )
        )
        result = await db.execute(query)
        existing = result.scalar_one_or_none()
        
        if existing:
            raise ValueError(f"이미 존재하는 가격 정책입니다: {PricePolicyService.ORIGIN_NAMES.get(origin, origin)} - {PricePolicyService.VEHICLE_CLASS_NAMES.get(vehicle_class, vehicle_class)}")
        
        # 가격 정책 생성
        price_policy = PricePolicy(
            id=uuid.uuid4(),
            origin=origin,
            vehicle_class=vehicle_class,
            add_amount=add_amount
        )
        db.add(price_policy)
        await db.commit()
        await db.refresh(price_policy)
        
        # Redis 캐시 무효화
        try:
            redis = await get_redis()
            await PricingService.invalidate_cache("quote:*")
            logger.info(f"가격 정책 생성 후 캐시 무효화 완료: {origin}/{vehicle_class}")
        except Exception as e:
            logger.warning(f"캐시 무효화 실패 (무시): {str(e)}")
        
        return {
            "id": str(price_policy.id),
            "origin": price_policy.origin,
            "vehicle_class": price_policy.vehicle_class,
            "add_amount": price_policy.add_amount,
            "created_at": price_policy.created_at.isoformat(),
            "updated_at": price_policy.updated_at.isoformat()
        }
    
    @staticmethod
    async def get_price_policy(
        db: AsyncSession,
        policy_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        가격 정책 조회
        
        Args:
            db: 데이터베이스 세션
            policy_id: 가격 정책 ID
        
        Returns:
            가격 정책 정보
        """
        query = select(PricePolicy).where(PricePolicy.id == uuid.UUID(policy_id))
        result = await db.execute(query)
        policy = result.scalar_one_or_none()
        
        if not policy:
            return None
        
        return {
            "id": str(policy.id),
            "origin": policy.origin,
            "vehicle_class": policy.vehicle_class,
            "add_amount": policy.add_amount,
            "created_at": policy.created_at.isoformat(),
            "updated_at": policy.updated_at.isoformat()
        }
    
    @staticmethod
    async def list_price_policies(
        db: AsyncSession,
        origin: Optional[str] = None,
        vehicle_class: Optional[str] = None,
        page: int = 1,
        limit: int = 100
    ) -> Dict[str, Any]:
        """
        가격 정책 목록 조회
        
        Args:
            db: 데이터베이스 세션
            origin: 국산/수입 필터
            vehicle_class: 차량 등급 필터
            page: 페이지 번호
            limit: 페이지 크기
        
        Returns:
            가격 정책 목록 및 페이지네이션 정보
        """
        # 기본 쿼리
        base_query = select(PricePolicy)
        count_query = select(func.count()).select_from(PricePolicy)
        
        # 필터 조건
        conditions = []
        if origin:
            conditions.append(PricePolicy.origin == origin)
        if vehicle_class:
            conditions.append(PricePolicy.vehicle_class == vehicle_class)
        
        if conditions:
            base_query = base_query.where(and_(*conditions))
            count_query = count_query.where(and_(*conditions))
        
        # 총 개수 조회
        count_result = await db.execute(count_query)
        total = count_result.scalar_one()
        
        # 정렬 및 페이지네이션
        base_query = base_query.order_by(
            asc(PricePolicy.origin),
            asc(PricePolicy.vehicle_class)
        )
        base_query = base_query.offset((page - 1) * limit).limit(limit)
        
        # 데이터 조회
        result = await db.execute(base_query)
        policies = result.scalars().all()
        
        items = [
            {
                "id": str(policy.id),
                "origin": policy.origin,
                "vehicle_class": policy.vehicle_class,
                "add_amount": policy.add_amount,
                "created_at": policy.created_at.isoformat(),
                "updated_at": policy.updated_at.isoformat()
            }
            for policy in policies
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
    async def update_price_policy(
        db: AsyncSession,
        policy_id: str,
        add_amount: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        가격 정책 수정
        
        Args:
            db: 데이터베이스 세션
            policy_id: 가격 정책 ID
            add_amount: 추가 금액
        
        Returns:
            수정된 가격 정책 정보
        """
        query = select(PricePolicy).where(PricePolicy.id == uuid.UUID(policy_id))
        result = await db.execute(query)
        policy = result.scalar_one_or_none()
        
        if not policy:
            raise ValueError("가격 정책을 찾을 수 없습니다")
        
        # 수정할 필드 업데이트
        if add_amount is not None:
            policy.add_amount = add_amount
        
        await db.commit()
        await db.refresh(policy)
        
        # Redis 캐시 무효화
        try:
            redis = await get_redis()
            await PricingService.invalidate_cache("quote:*")
            logger.info(f"가격 정책 수정 후 캐시 무효화 완료: {policy.origin}/{policy.vehicle_class}")
        except Exception as e:
            logger.warning(f"캐시 무효화 실패 (무시): {str(e)}")
        
        return {
            "id": str(policy.id),
            "origin": policy.origin,
            "vehicle_class": policy.vehicle_class,
            "add_amount": policy.add_amount,
            "created_at": policy.created_at.isoformat(),
            "updated_at": policy.updated_at.isoformat()
        }
    
    @staticmethod
    async def delete_price_policy(
        db: AsyncSession,
        policy_id: str
    ) -> bool:
        """
        가격 정책 삭제
        
        Args:
            db: 데이터베이스 세션
            policy_id: 가격 정책 ID
        
        Returns:
            삭제 성공 여부
        """
        query = select(PricePolicy).where(PricePolicy.id == uuid.UUID(policy_id))
        result = await db.execute(query)
        policy = result.scalar_one_or_none()
        
        if not policy:
            raise ValueError("가격 정책을 찾을 수 없습니다")
        
        # TODO: 활성 신청 건 체크 (향후 구현)
        # active_inspections = await db.execute(
        #     select(func.count()).select_from(Inspection)
        #     .where(Inspection.status.in_(['pending', 'assigned', 'in_progress']))
        # )
        # if active_inspections.scalar_one() > 0:
        #     raise ValueError("활성 신청 건이 있어 삭제할 수 없습니다")
        
        origin = policy.origin
        vehicle_class = policy.vehicle_class
        
        await db.delete(policy)
        await db.commit()
        
        # Redis 캐시 무효화
        try:
            redis = await get_redis()
            await PricingService.invalidate_cache("quote:*")
            logger.info(f"가격 정책 삭제 후 캐시 무효화 완료: {origin}/{vehicle_class}")
        except Exception as e:
            logger.warning(f"캐시 무효화 실패 (무시): {str(e)}")
        
        return True

