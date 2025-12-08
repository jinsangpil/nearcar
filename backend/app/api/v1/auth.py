"""
인증 관련 API 엔드포인트
"""
from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from app.core.database import get_db
from app.core.security import (
    verify_password,
    create_access_token,
    create_guest_token,
    decode_token,
    encrypt_phone
)
from app.core.redis import set_guest_auth, get_guest_auth, delete_guest_auth
from app.core.config import settings
from app.models.user import User
from app.schemas.auth import LoginRequest, GuestAuthRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["인증"])
security = HTTPBearer()


@router.post("/login", response_model=TokenResponse)
async def login(
    login_data: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """
    사용자 로그인 엔드포인트
    
    - 이메일/비밀번호 또는 휴대폰 인증 지원
    - 성공 시 Access Token 발급 및 쿠키에 저장
    """
    try:
        user = None
        
        # 이메일/비밀번호 로그인
        if login_data.email and login_data.password:
            if not login_data.password:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="비밀번호가 필요합니다"
                )
            
            result = await db.execute(
                select(User).where(User.email == login_data.email)
            )
            user = result.scalar_one_or_none()
            
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="이메일 또는 비밀번호가 올바르지 않습니다"
                )
            
            if not user.password_hash:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="비밀번호가 설정되지 않은 계정입니다"
                )
            
            if not verify_password(login_data.password, user.password_hash):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="이메일 또는 비밀번호가 올바르지 않습니다"
                )
        
        # 휴대폰 인증 (비밀번호 없이)
        elif login_data.phone:
            encrypted_phone = encrypt_phone(login_data.phone)
            result = await db.execute(
                select(User).where(User.phone == encrypted_phone)
            )
            user = result.scalar_one_or_none()
            
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="등록되지 않은 휴대폰 번호입니다"
                )
        
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이메일/비밀번호 또는 휴대폰 번호를 입력해주세요"
            )
        
        # 계정 상태 확인
        if user.status != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="비활성화된 계정입니다"
            )
        
        # 토큰 생성
        token_data = {
            "sub": str(user.id),
            "role": user.role,
            "type": "access"
        }
        access_token = create_access_token(data=token_data)
        
        # 쿠키에 토큰 저장
        response.set_cookie(
            key="access_token",
            value=access_token,
            max_age=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            httponly=settings.COOKIE_HTTP_ONLY,
            secure=settings.COOKIE_SECURE,
            samesite=settings.COOKIE_SAME_SITE
        )
        
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"로그인 오류: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"로그인 중 오류가 발생했습니다: {str(e)}"
        )


@router.post("/guest", response_model=TokenResponse)
async def guest_auth(
    guest_data: GuestAuthRequest,
    response: Response
):
    """
    비회원 인증 엔드포인트
    
    - 휴대폰 번호 기반 임시 토큰 발급
    - Redis에 인증 상태 저장 (TTL: 30분)
    """
    # 휴대폰 번호 검증 (간단한 형식 검증)
    phone = guest_data.phone.replace("-", "").replace(" ", "")
    if not phone.isdigit() or len(phone) < 10 or len(phone) > 11:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="올바른 휴대폰 번호 형식이 아닙니다"
        )
    
    # 임시 토큰 생성
    access_token = create_guest_token(phone=phone)
    
    # Redis에 인증 상태 저장
    ttl_seconds = settings.JWT_GUEST_TOKEN_EXPIRE_MINUTES * 60
    redis_success = await set_guest_auth(phone, access_token, ttl_seconds)
    
    if not redis_success:
        # Redis 저장 실패 시에도 토큰은 발급 (로깅 후 계속 진행)
        # 프로덕션에서는 더 엄격한 오류 처리 필요
        pass
    
    # 쿠키에 토큰 저장
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=ttl_seconds,
        httponly=settings.COOKIE_HTTP_ONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAME_SITE
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=ttl_seconds
    )


@router.post("/logout")
async def logout(response: Response):
    """
    로그아웃 엔드포인트
    
    - 쿠키에서 토큰 제거
    """
    response.delete_cookie(
        key="access_token",
        httponly=settings.COOKIE_HTTP_ONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAME_SITE
    )
    
    return {"message": "로그아웃되었습니다"}

