"""
차량 모델
"""
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class VehicleModel(Base):
    """차량 모델"""
    __tablename__ = "vehicle_models"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    manufacturer_id = Column(UUID(as_uuid=True), ForeignKey("manufacturers.id", ondelete="RESTRICT"), nullable=False)
    model_group = Column(String(100), nullable=False)
    model_detail = Column(String(100), nullable=True)
    vehicle_class = Column(String(20), nullable=False)  # compact, small, mid, large, suv, sports, supercar
    start_year = Column(Integer, nullable=False)
    end_year = Column(Integer, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    manufacturer = relationship("Manufacturer", back_populates="vehicle_models")
    
    def __repr__(self):
        return f"<VehicleModel(id={self.id}, manufacturer_id={self.manufacturer_id}, model_group={self.model_group})>"

