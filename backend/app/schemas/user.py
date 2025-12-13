"""
유저 관리 관련 스키마
"""
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


class UserCreateRequest(BaseModel):
    """유저 생성 요청 스키마"""
    role: str = Field(..., description="역할 (client, inspector, staff, admin)")
    name: str = Field(..., min_length=1, max_length=100, description="이름")
    email: Optional[EmailStr] = Field(None, description="이메일")
    phone: str = Field(..., min_length=10, max_length=11, description="휴대폰 번호")
    password: Optional[str] = Field(None, min_length=8, description="비밀번호 (선택)")
    region_ids: Optional[List[str]] = Field(None, description="활동 지역 ID 목록 (기사용, 다중 지역 지원)")
    level: Optional[int] = Field(None, ge=1, le=5, description="기사 등급 (1~5)")
    commission_rate: Optional[Decimal] = Field(None, ge=0, le=100, description="수수료율 (0~100%)")
    status: str = Field("active", description="계정 상태 (active, inactive, suspended)")
    
    @field_validator('role')
    @classmethod
    def validate_role(cls, v):
        valid_roles = ['client', 'inspector', 'staff', 'admin']
        if v not in valid_roles:
            raise ValueError(f'역할은 {valid_roles} 중 하나여야 합니다')
        return v
    
    @field_validator('status')
    @classmethod
    def validate_status(cls, v):
        valid_statuses = ['active', 'inactive', 'suspended']
        if v not in valid_statuses:
            raise ValueError(f'상태는 {valid_statuses} 중 하나여야 합니다')
        return v
    
    @model_validator(mode='after')
    def validate_inspector_fields(self):
        """기사 역할인 경우 등급, 수수료율, 활동 지역 필수"""
        if self.role == 'inspector':
            if self.level is None:
                raise ValueError('기사는 등급(level)이 필수입니다')
            if self.commission_rate is None:
                raise ValueError('기사는 수수료율(commission_rate)이 필수입니다')
            if not self.region_ids or len(self.region_ids) == 0:
                raise ValueError('기사는 활동 지역(region_ids)이 최소 1개 이상 필요합니다')
        return self
    
    class Config:
        json_schema_extra = {
            "example": {
                "role": "inspector",
                "name": "홍길동",
                "email": "inspector@example.com",
                "phone": "01012345678",
                "password": "password123",
                "region_ids": ["550e8400-e29b-41d4-a716-446655440000", "660e8400-e29b-41d4-a716-446655440001"],
                "level": 3,
                "commission_rate": 15.5,
                "status": "active"
            }
        }


class UserUpdateRequest(BaseModel):
    """유저 수정 요청 스키마"""
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="이름")
    email: Optional[EmailStr] = Field(None, description="이메일")
    phone: Optional[str] = Field(None, min_length=10, max_length=11, description="휴대폰 번호")
    password: Optional[str] = Field(None, min_length=8, description="비밀번호 (변경 시)")
    region_ids: Optional[List[str]] = Field(None, description="활동 지역 ID 목록 (기사용, 다중 지역 지원)")
    level: Optional[int] = Field(None, ge=1, le=5, description="기사 등급 (1~5)")
    commission_rate: Optional[Decimal] = Field(None, ge=0, le=100, description="수수료율 (0~100%)")
    status: Optional[str] = Field(None, description="계정 상태")
    
    @field_validator('status')
    @classmethod
    def validate_status(cls, v):
        if v is not None:
            valid_statuses = ['active', 'inactive', 'suspended']
            if v not in valid_statuses:
                raise ValueError(f'상태는 {valid_statuses} 중 하나여야 합니다')
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "홍길동",
                "email": "inspector@example.com",
                "phone": "01012345678",
                "region_ids": ["550e8400-e29b-41d4-a716-446655440000", "660e8400-e29b-41d4-a716-446655440001"],
                "level": 4,
                "commission_rate": 18.0
            }
        }


class UserResponse(BaseModel):
    """유저 응답 스키마"""
    id: str
    role: str
    name: str
    email: Optional[str]
    phone: str  # 복호화된 전화번호
    region_ids: List[str] = Field(default_factory=list, description="활동 지역 ID 목록 (기사용)")
    level: Optional[int]
    commission_rate: Optional[Decimal]
    status: str
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    """유저 목록 응답 스키마"""
    items: List[UserResponse]
    total: int
    page: int
    limit: int
    total_pages: int


class UserLevelUpdateRequest(BaseModel):
    """기사 등급 변경 요청 스키마"""
    level: int = Field(..., ge=1, le=5, description="기사 등급 (1~5)")


class UserCommissionUpdateRequest(BaseModel):
    """수수료율 변경 요청 스키마"""
    commission_rate: Decimal = Field(..., ge=0, le=100, description="수수료율 (0~100%)")


class UserRegionUpdateRequest(BaseModel):
    """활동 지역 변경 요청 스키마 (deprecated: update_user의 region_ids 사용 권장)"""
    region_ids: List[str] = Field(..., min_length=1, description="활동 지역 ID 목록")


class UserRoleUpdateRequest(BaseModel):
    """역할 변경 요청 스키마"""
    role: str = Field(..., description="새 역할")
    
    @field_validator('role')
    @classmethod
    def validate_role(cls, v):
        valid_roles = ['client', 'inspector', 'staff', 'admin']
        if v not in valid_roles:
            raise ValueError(f'역할은 {valid_roles} 중 하나여야 합니다')
        return v


class UserStatusUpdateRequest(BaseModel):
    """계정 상태 변경 요청 스키마"""
    status: str = Field(..., description="새 상태")
    
    @field_validator('status')
    @classmethod
    def validate_status(cls, v):
        valid_statuses = ['active', 'inactive', 'suspended']
        if v not in valid_statuses:
            raise ValueError(f'상태는 {valid_statuses} 중 하나여야 합니다')
        return v

