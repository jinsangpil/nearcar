"""
리뷰 모델
"""
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from app.core.database import Base


class Review(Base):
    """리뷰 모델"""
    __tablename__ = "reviews"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    inspection_id = Column(UUID(as_uuid=True), ForeignKey("inspections.id"), nullable=False, unique=True)
    rating = Column(Integer, nullable=False)  # 1-5
    content = Column(Text, nullable=True)
    photos = Column(JSONB, nullable=True)  # List of URLs
    is_hidden = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # 관계
    user = relationship("User", backref="reviews")
    inspection = relationship("Inspection", backref="review")
    
    def __repr__(self):
        return f"<Review(id={self.id}, rating={self.rating}, user_id={self.user_id})>"
