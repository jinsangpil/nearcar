"""
유저 관리 서비스
"""
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from datetime import datetime
import uuid

from app.models.user import User
from app.core.security import get_password_hash, encrypt_phone, decrypt_phone
from app.services.inspector_region_service import InspectorRegionService
from loguru import logger


class UserService:
    """유저 관리 서비스"""
    
    @staticmethod
    async def create_user(
        db: AsyncSession,
        role: str,
        name: str,
        phone: str,
        email: Optional[str] = None,
        password: Optional[str] = None,
        region_ids: Optional[List[str]] = None,
        level: Optional[int] = None,
        commission_rate: Optional[float] = None,
        status: str = "active"
    ) -> Dict[str, Any]:
        """
        유저 생성
        
        Args:
            db: 데이터베이스 세션
            role: 역할
            name: 이름
            phone: 전화번호 (평문)
            email: 이메일
            password: 비밀번호 (평문)
            region_ids: 활동 지역 ID 목록 (기사 전용)
            level: 기사 등급 (1~5)
            commission_rate: 수수료율 (0~100)
            status: 계정 상태
        
        Returns:
            생성된 유저 정보
        """
        # 이메일 중복 체크
        if email:
            result = await db.execute(
                select(User).where(User.email == email)
            )
            existing = result.scalar_one_or_none()
            if existing:
                raise ValueError("이미 사용 중인 이메일입니다")
        
        # 전화번호 중복 체크 (암호화 후 비교)
        encrypted_phone = encrypt_phone(phone)
        result = await db.execute(
            select(User).where(User.phone == encrypted_phone)
        )
        existing = result.scalar_one_or_none()
        if existing:
            raise ValueError("이미 사용 중인 전화번호입니다")
        
        # 기사 역할인 경우 필수 필드 검증
        if role == "inspector":
            if level is None:
                raise ValueError("기사는 등급(level)이 필수입니다")
            if commission_rate is None:
                raise ValueError("기사는 수수료율(commission_rate)이 필수입니다")
            if not region_ids or len(region_ids) == 0:
                raise ValueError("기사는 활동 지역(region_ids)이 최소 1개 이상 필요합니다")
        
        # 비밀번호 해싱
        password_hash = None
        if password:
            password_hash = get_password_hash(password)
        
        # 유저 생성
        user = User(
            id=uuid.uuid4(),
            role=role,
            name=name,
            phone=encrypted_phone,
            email=email,
            password_hash=password_hash,
            level=level,
            commission_rate=commission_rate,
            status=status
        )
        
        db.add(user)
        await db.flush()  # user.id를 얻기 위해 flush
        
        # 기사인 경우 활동 지역 생성
        if role == "inspector" and region_ids:
            await InspectorRegionService.create_inspector_regions(
                db, str(user.id), region_ids
            )
        
        await db.commit()
        await db.refresh(user)
        
        logger.info(f"유저 생성: {user.id} ({name}, {role})")
        
        return {
            "id": str(user.id),
            "role": user.role,
            "name": user.name,
            "email": user.email,
            "phone": phone,  # 복호화된 전화번호 반환
            "status": user.status
        }
    
    @staticmethod
    async def get_user(
        db: AsyncSession,
        user_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        유저 상세 조회
        
        Args:
            db: 데이터베이스 세션
            user_id: 유저 ID
        
        Returns:
            유저 정보 (없으면 None)
        """
        result = await db.execute(
            select(User).where(User.id == uuid.UUID(user_id))
        )
        user = result.scalar_one_or_none()
        
        if not user:
            return None
        
        # 전화번호 복호화
        phone = decrypt_phone(user.phone) if user.phone else None
        
        # 기사인 경우 활동 지역 ID 목록 조회
        region_ids = []
        if user.role == "inspector":
            try:
                region_ids = await InspectorRegionService.get_inspector_regions(
                    db, str(user.id)
                )
            except Exception as e:
                # inspector_regions 테이블이 없거나 오류가 발생한 경우 빈 배열 반환
                logger.warning(f"기사 활동 지역 조회 실패 (user_id={user.id}): {str(e)}")
                region_ids = []
        
        return {
            "id": str(user.id),
            "role": user.role,
            "name": user.name,
            "email": user.email,
            "phone": phone,
            "region_ids": region_ids,
            "level": user.level,
            "commission_rate": float(user.commission_rate) if user.commission_rate else None,
            "status": user.status,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "updated_at": user.updated_at.isoformat() if user.updated_at else None
        }
    
    @staticmethod
    async def update_user(
        db: AsyncSession,
        user_id: str,
        name: Optional[str] = None,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        password: Optional[str] = None,
        region_ids: Optional[List[str]] = None,
        level: Optional[int] = None,
        commission_rate: Optional[float] = None,
        status: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        유저 정보 수정
        
        Args:
            db: 데이터베이스 세션
            user_id: 유저 ID
            name: 이름
            email: 이메일
            phone: 전화번호
            password: 비밀번호
            region_ids: 활동 지역 ID 목록 (기사 전용)
            level: 기사 등급
            commission_rate: 수수료율
            status: 계정 상태
        
        Returns:
            수정된 유저 정보
        """
        result = await db.execute(
            select(User).where(User.id == uuid.UUID(user_id))
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise ValueError("유저를 찾을 수 없습니다")
        
        # 이메일 중복 체크 (다른 유저가 사용 중인지)
        if email and email != user.email:
            result = await db.execute(
                select(User).where(User.email == email)
            )
            existing = result.scalar_one_or_none()
            if existing:
                raise ValueError("이미 사용 중인 이메일입니다")
        
        # 전화번호 중복 체크 (다른 유저가 사용 중인지)
        if phone:
            encrypted_phone = encrypt_phone(phone)
            if encrypted_phone != user.phone:
                result = await db.execute(
                    select(User).where(User.phone == encrypted_phone)
                )
                existing = result.scalar_one_or_none()
                if existing:
                    raise ValueError("이미 사용 중인 전화번호입니다")
                user.phone = encrypted_phone
        
        # 필드 업데이트
        if name is not None:
            user.name = name
        if email is not None:
            user.email = email
        if password is not None:
            user.password_hash = get_password_hash(password)
        if level is not None:
            user.level = level
        if commission_rate is not None:
            user.commission_rate = commission_rate
        if status is not None:
            user.status = status
        
        # 기사인 경우 활동 지역 업데이트
        if user.role == "inspector" and region_ids is not None:
            if len(region_ids) == 0:
                raise ValueError("기사는 활동 지역(region_ids)이 최소 1개 이상 필요합니다")
            await InspectorRegionService.update_inspector_regions(
                db, str(user.id), region_ids
            )
        
        await db.commit()
        await db.refresh(user)
        
        logger.info(f"유저 수정: {user.id} ({user.name})")
        
        # 전화번호 복호화
        phone_decrypted = decrypt_phone(user.phone) if user.phone else None
        
        return {
            "id": str(user.id),
            "role": user.role,
            "name": user.name,
            "email": user.email,
            "phone": phone_decrypted,
            "status": user.status
        }
    
    @staticmethod
    async def delete_user(
        db: AsyncSession,
        user_id: str
    ) -> Dict[str, Any]:
        """
        유저 삭제 (Soft Delete)
        
        Args:
            db: 데이터베이스 세션
            user_id: 유저 ID
        
        Returns:
            삭제된 유저 정보
        """
        result = await db.execute(
            select(User).where(User.id == uuid.UUID(user_id))
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise ValueError("유저를 찾을 수 없습니다")
        
        # Soft Delete: 상태를 inactive로 변경
        user.status = "inactive"
        
        await db.commit()
        await db.refresh(user)
        
        logger.info(f"유저 삭제 (Soft Delete): {user.id} ({user.name})")
        
        return {
            "id": str(user.id),
            "status": user.status
        }
    
    @staticmethod
    async def list_users(
        db: AsyncSession,
        role: Optional[str] = None,
        status: Optional[str] = None,
        level: Optional[int] = None,
        search: Optional[str] = None,
        offset: int = 0,
        limit: int = 20
    ) -> Dict[str, Any]:
        """
        유저 목록 조회
        
        Args:
            db: 데이터베이스 세션
            role: 역할 필터
            status: 상태 필터
            level: 등급 필터 (기사용)
            search: 검색어 (이름, 이메일, 전화번호)
            offset: 오프셋
            limit: 제한
        
        Returns:
            유저 목록 및 페이지네이션 정보
        """
        # 기본 쿼리
        query = select(User)
        conditions = []
        
        # 필터링
        if role:
            conditions.append(User.role == role)
        if status:
            conditions.append(User.status == status)
        if level is not None:
            conditions.append(User.level == level)
        
        # 검색 (이름, 이메일)
        if search:
            search_conditions = [
                User.name.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%") if User.email else False
            ]
            # 전화번호 검색은 복잡하므로 일단 이름/이메일만
            conditions.append(or_(*[c for c in search_conditions if c]))
        
        if conditions:
            query = query.where(and_(*conditions))
        
        # 총 개수 조회
        count_query = select(func.count()).select_from(User)
        if conditions:
            count_query = count_query.where(and_(*conditions))
        total_result = await db.execute(count_query)
        total = total_result.scalar()
        
        # 페이지네이션
        query = query.offset(offset).limit(limit)
        
        # 정렬 (최신순)
        query = query.order_by(User.created_at.desc())
        
        # 실행
        result = await db.execute(query)
        users = result.scalars().all()
        
        # 전화번호 복호화 및 활동 지역 조회
        items = []
        for user in users:
            phone = decrypt_phone(user.phone) if user.phone else None
            
            # 기사인 경우 활동 지역 ID 목록 조회
            region_ids = []
            if user.role == "inspector":
                try:
                    region_ids = await InspectorRegionService.get_inspector_regions(
                        db, str(user.id)
                    )
                except Exception as e:
                    # inspector_regions 테이블이 없거나 오류가 발생한 경우 빈 배열 반환
                    logger.warning(f"기사 활동 지역 조회 실패 (user_id={user.id}): {str(e)}")
                    region_ids = []
            
            items.append({
                "id": str(user.id),
                "role": user.role,
                "name": user.name,
                "email": user.email,
                "phone": phone,
                "region_ids": region_ids,
                "level": user.level,
                "commission_rate": float(user.commission_rate) if user.commission_rate else None,
                "status": user.status,
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "updated_at": user.updated_at.isoformat() if user.updated_at else None
            })
        
        total_pages = (total + limit - 1) // limit if limit > 0 else 0
        page = (offset // limit) + 1 if limit > 0 else 1
        
        return {
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": total_pages
        }
    
    @staticmethod
    async def update_user_level(
        db: AsyncSession,
        user_id: str,
        level: int
    ) -> Dict[str, Any]:
        """
        기사 등급 변경
        
        Args:
            db: 데이터베이스 세션
            user_id: 유저 ID
            level: 새 등급 (1~5)
        
        Returns:
            업데이트된 유저 정보
        """
        result = await db.execute(
            select(User).where(User.id == uuid.UUID(user_id))
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise ValueError("유저를 찾을 수 없습니다")
        
        if user.role != "inspector":
            raise ValueError("기사만 등급을 변경할 수 있습니다")
        
        if level < 1 or level > 5:
            raise ValueError("등급은 1~5 사이여야 합니다")
        
        old_level = user.level
        user.level = level
        
        await db.commit()
        await db.refresh(user)
        
        logger.info(f"기사 등급 변경: {user.id} ({user.name}) {old_level} -> {level}")
        
        return {
            "id": str(user.id),
            "level": user.level
        }
    
    @staticmethod
    async def update_user_commission(
        db: AsyncSession,
        user_id: str,
        commission_rate: float
    ) -> Dict[str, Any]:
        """
        수수료율 변경
        
        Args:
            db: 데이터베이스 세션
            user_id: 유저 ID
            commission_rate: 새 수수료율 (0~100)
        
        Returns:
            업데이트된 유저 정보
        """
        result = await db.execute(
            select(User).where(User.id == uuid.UUID(user_id))
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise ValueError("유저를 찾을 수 없습니다")
        
        if user.role != "inspector":
            raise ValueError("기사만 수수료율을 변경할 수 있습니다")
        
        if commission_rate < 0 or commission_rate > 100:
            raise ValueError("수수료율은 0~100 사이여야 합니다")
        
        old_commission = user.commission_rate
        user.commission_rate = commission_rate
        
        await db.commit()
        await db.refresh(user)
        
        logger.info(f"수수료율 변경: {user.id} ({user.name}) {old_commission} -> {commission_rate}")
        
        return {
            "id": str(user.id),
            "commission_rate": float(user.commission_rate) if user.commission_rate else None
        }
    
    
    @staticmethod
    async def update_user_role(
        db: AsyncSession,
        user_id: str,
        new_role: str,
        current_user_id: str
    ) -> Dict[str, Any]:
        """
        역할 변경
        
        Args:
            db: 데이터베이스 세션
            user_id: 변경할 유저 ID
            new_role: 새 역할
            current_user_id: 현재 요청한 사용자 ID (권한 검증용)
        
        Returns:
            업데이트된 유저 정보
        """
        result = await db.execute(
            select(User).where(User.id == uuid.UUID(user_id))
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise ValueError("유저를 찾을 수 없습니다")
        
        # 자기 자신의 역할 변경 불가
        if str(user.id) == current_user_id:
            raise ValueError("자기 자신의 역할은 변경할 수 없습니다")
        
        # admin 역할 부여는 admin만 가능
        if new_role == "admin":
            current_user_result = await db.execute(
                select(User).where(User.id == uuid.UUID(current_user_id))
            )
            current_user = current_user_result.scalar_one_or_none()
            if not current_user or current_user.role != "admin":
                raise ValueError("admin 역할은 관리자만 부여할 수 있습니다")
        
        old_role = user.role
        user.role = new_role
        
        # 역할 변경 시 기사 관련 필드 초기화 (기사가 아닌 경우)
        if new_role != "inspector":
            user.level = None
            user.commission_rate = None
            # 활동 지역 삭제
            await InspectorRegionService.delete_inspector_regions(db, str(user.id))
        
        await db.commit()
        await db.refresh(user)
        
        logger.info(f"역할 변경: {user.id} ({user.name}) {old_role} -> {new_role}")
        
        return {
            "id": str(user.id),
            "role": user.role
        }
    
    @staticmethod
    async def update_user_status(
        db: AsyncSession,
        user_id: str,
        new_status: str
    ) -> Dict[str, Any]:
        """
        계정 상태 변경
        
        Args:
            db: 데이터베이스 세션
            user_id: 유저 ID
            new_status: 새 상태 (active/inactive/suspended)
        
        Returns:
            업데이트된 유저 정보
        """
        result = await db.execute(
            select(User).where(User.id == uuid.UUID(user_id))
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise ValueError("유저를 찾을 수 없습니다")
        
        valid_statuses = ["active", "inactive", "suspended"]
        if new_status not in valid_statuses:
            raise ValueError(f"상태는 {valid_statuses} 중 하나여야 합니다")
        
        old_status = user.status
        user.status = new_status
        
        await db.commit()
        await db.refresh(user)
        
        logger.info(f"계정 상태 변경: {user.id} ({user.name}) {old_status} -> {new_status}")
        
        return {
            "id": str(user.id),
            "status": user.status
        }

