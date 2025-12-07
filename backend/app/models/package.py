"""
진단 패키지 모델
"""
from sqlalchemy import Column, String, Integer, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class Package(Base):
    """진단 패키지 모델"""
    __tablename__ = "packages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(50), nullable=False, unique=True)
    base_price = Column(Integer, nullable=False)
    included_items = Column(JSONB, nullable=False, default={})
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<Package(id={self.id}, name={self.name}, base_price={self.base_price})>"

