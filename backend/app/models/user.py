"""
사용자 모델
"""
from sqlalchemy import Column, String, Integer, Numeric, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from app.core.database import Base


class User(Base):
    """사용자 모델"""
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role = Column(String(20), nullable=False)  # client, inspector, staff, admin
    name = Column(String(100), nullable=False)
    phone = Column(String(256), nullable=False)  # 암호화 저장
    email = Column(String(100), nullable=True)
    password_hash = Column(String(256), nullable=True)  # 비회원은 NULL
    region_id = Column(UUID(as_uuid=True), ForeignKey("service_regions.id"), nullable=True)
    level = Column(Integer, nullable=True)  # 기사 등급 (1~5)
    commission_rate = Column(Numeric(5, 2), nullable=True)  # 기사 수수료율
    status = Column(String(20), nullable=False, default="active")  # active, inactive, suspended
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # 관계
    # region = relationship("ServiceRegion", back_populates="inspectors")
    # vehicles = relationship("Vehicle", back_populates="owner")
    inspections = relationship("Inspection", foreign_keys="Inspection.user_id", back_populates="user")
    
    def __repr__(self):
        return f"<User(id={self.id}, role={self.role}, name={self.name})>"

