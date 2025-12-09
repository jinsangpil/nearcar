"""
제조사 모델
"""
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class Manufacturer(Base):
    """제조사 모델"""
    __tablename__ = "manufacturers"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(50), nullable=False)
    origin = Column(String(20), nullable=False)  # domestic, imported
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    vehicle_models = relationship("VehicleModel", back_populates="manufacturer", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Manufacturer(id={self.id}, name={self.name}, origin={self.origin})>"

