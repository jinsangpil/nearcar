"""
서비스 지역 모델
"""
from sqlalchemy import Column, String, Integer, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class ServiceRegion(Base):
    """서비스 지역 모델"""
    __tablename__ = "service_regions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    province = Column(String(50), nullable=False)
    province_code = Column(String(2), nullable=True)  # 광역시도 코드 (11, 21, 22 등)
    city = Column(String(50), nullable=False)
    city_code = Column(String(5), nullable=True)  # 시군구 코드
    extra_fee = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<ServiceRegion(id={self.id}, province={self.province}, city={self.city}, extra_fee={self.extra_fee})>"

