"""
인증 관련 스키마
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class LoginRequest(BaseModel):
    """로그인 요청 스키마"""
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "password": "password123"
            }
        }


class GuestAuthRequest(BaseModel):
    """비회원 인증 요청 스키마"""
    phone: str = Field(..., min_length=10, max_length=11, description="휴대폰 번호")
    
    class Config:
        json_schema_extra = {
            "example": {
                "phone": "01012345678"
            }
        }


class RegisterRequest(BaseModel):
    """회원가입 요청 스키마"""
    email: EmailStr = Field(..., description="이메일")
    password: str = Field(..., min_length=8, description="비밀번호 (8자 이상)")
    name: str = Field(..., min_length=1, max_length=100, description="이름")
    phone: str = Field(..., min_length=10, max_length=11, description="휴대폰 번호")
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "password": "password123",
                "name": "홍길동",
                "phone": "01012345678"
            }
        }


class TokenResponse(BaseModel):
    """토큰 응답 스키마"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # 초 단위
    
    class Config:
        json_schema_extra = {
            "example": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "token_type": "bearer",
                "expires_in": 7200
            }
        }


class UserInfo(BaseModel):
    """사용자 정보 스키마"""
    id: str
    role: str
    name: str
    email: Optional[str] = None
    
    class Config:
        from_attributes = True

