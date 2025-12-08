"""
의존성 주입 함수들
- 토큰 검증 미들웨어
- 역할 기반 접근 제어 (RBAC)
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List

from app.core.database import get_db
from app.core.security import decode_token
from app.core.redis import check_guest_auth
from app.models.user import User

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    현재 인증된 사용자 조회
    
    요청 헤더에서 JWT 토큰을 추출하고 검증하여 사용자 정보를 반환합니다.
    
    Raises:
        HTTPException: 토큰이 유효하지 않거나 사용자를 찾을 수 없는 경우
    """
    token = credentials.credentials
    
    # 토큰 디코딩 및 검증
    payload = decode_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰입니다",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 사용자 ID 추출 및 UUID 변환
    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰에 사용자 정보가 없습니다",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # UUID 변환
    try:
        import uuid
        user_id = uuid.UUID(user_id_str)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 사용자 ID 형식입니다",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 사용자 조회
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="사용자를 찾을 수 없습니다",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 계정 상태 확인
    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="비활성화된 계정입니다"
        )
    
    return user


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """
    선택적 사용자 인증 (토큰이 없어도 허용)
    
    비회원 접근이 가능한 엔드포인트에서 사용합니다.
    """
    if credentials is None:
        return None
    
    try:
        return await get_current_user(credentials, db)
    except HTTPException:
        return None


def require_role(allowed_roles: List[str], require_admin_for_admin_role: bool = False):
    """
    역할 기반 접근 제어 데코레이터 팩토리
    
    Args:
        allowed_roles: 접근을 허용할 역할 리스트 (예: ['admin', 'staff'])
        require_admin_for_admin_role: admin 역할 관련 작업인 경우 admin만 허용할지 여부
    
    Usage:
        @router.get("/admin/users")
        async def get_users(
            current_user: User = Depends(require_role(['admin', 'staff']))
        ):
            ...
    """
    async def role_checker(
        current_user: User = Depends(get_current_user)
    ) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"이 작업을 수행할 권한이 없습니다. 필요한 역할: {', '.join(allowed_roles)}"
            )
        
        # admin 역할 관련 작업은 admin만 허용
        if require_admin_for_admin_role and current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="이 작업은 관리자만 수행할 수 있습니다"
            )
        
        return current_user
    
    return role_checker


def require_admin_only():
    """
    관리자만 접근 허용 데코레이터
    
    Usage:
        @router.post("/admin/users/{id}/role")
        async def update_role(
            current_user: User = Depends(require_admin_only())
        ):
            ...
    """
    return require_role(["admin"])


def require_admin_or_staff():
    """
    관리자 또는 직원 접근 허용 데코레이터
    
    Usage:
        @router.get("/admin/users")
        async def get_users(
            current_user: User = Depends(require_admin_or_staff())
        ):
            ...
    """
    return require_role(["admin", "staff"])


def require_guest_or_user():
    """
    비회원 또는 회원 접근 허용 데코레이터
    
    비회원(guest) 토큰과 일반 사용자 토큰 모두 허용합니다.
    Redis에서 비회원 인증 상태를 확인합니다.
    """
    async def guest_or_user_checker(
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
        db: AsyncSession = Depends(get_db)
    ) -> Optional[User]:
        if credentials is None:
            return None
        
        token = credentials.credentials
        payload = decode_token(token)
        
        if payload is None:
            return None
        
        # 비회원 토큰인 경우
        if payload.get("type") == "guest":
            phone = payload.get("sub")
            if phone:
                # Redis에서 인증 상태 확인
                is_valid = await check_guest_auth(phone, token)
                if is_valid:
                    return None  # 비회원은 User 객체 없이 진행
            return None
        
        # 일반 사용자 토큰인 경우
        user_id = payload.get("sub")
        if user_id:
            result = await db.execute(
                select(User).where(User.id == user_id)
            )
            user = result.scalar_one_or_none()
            if user and user.status == "active":
                return user
        
        return None
    
    return guest_or_user_checker

