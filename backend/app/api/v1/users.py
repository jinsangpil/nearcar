"""
사용자 관련 API 엔드포인트
RBAC 데코레이터 사용 예시 포함
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User
from app.schemas.auth import UserInfo

router = APIRouter(prefix="/users", tags=["사용자"])


@router.get("/me", response_model=UserInfo)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """
    현재 로그인한 사용자 정보 조회
    
    인증이 필요한 엔드포인트 예시입니다.
    """
    return UserInfo(
        id=str(current_user.id),
        role=current_user.role,
        name=current_user.name,
        email=current_user.email
    )


@router.get("/admin/list")
async def get_all_users(
    current_user: User = Depends(require_role(['admin', 'staff'])),
    db: AsyncSession = Depends(get_db)
):
    """
    모든 사용자 목록 조회 (관리자/직원만 접근 가능)
    
    RBAC 데코레이터 사용 예시입니다.
    """
    from sqlalchemy import select
    
    result = await db.execute(select(User))
    users = result.scalars().all()
    
    return [
        {
            "id": str(user.id),
            "role": user.role,
            "name": user.name,
            "email": user.email,
            "status": user.status
        }
        for user in users
    ]


@router.get("/inspector/list")
async def get_inspectors(
    current_user: User = Depends(require_role(['admin', 'staff', 'inspector'])),
    db: AsyncSession = Depends(get_db)
):
    """
    기사 목록 조회 (관리자/직원/기사만 접근 가능)
    """
    from sqlalchemy import select
    
    result = await db.execute(
        select(User).where(User.role == "inspector", User.status == "active")
    )
    inspectors = result.scalars().all()
    
    return [
        {
            "id": str(inspector.id),
            "name": inspector.name,
            "level": inspector.level,
            "commission_rate": float(inspector.commission_rate) if inspector.commission_rate else None
        }
        for inspector in inspectors
    ]

