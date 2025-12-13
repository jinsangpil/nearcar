"""
기사 활동 지역 모델
"""
from sqlalchemy import Column, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from app.core.database import Base


class InspectorRegion(Base):
    """기사 활동 지역 매핑 모델 (다대다 관계)"""
    __tablename__ = "inspector_regions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    region_id = Column(UUID(as_uuid=True), ForeignKey("service_regions.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # 관계
    user = relationship("User", back_populates="inspector_regions")
    region = relationship("ServiceRegion", back_populates="inspectors")
    
    def __repr__(self):
        return f"<InspectorRegion(id={self.id}, user_id={self.user_id}, region_id={self.region_id})>"

