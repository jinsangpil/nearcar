"""
차량 마스터 모델
"""
from sqlalchemy import Column, String, Integer, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class VehicleMaster(Base):
    """차량 마스터 모델"""
    __tablename__ = "vehicle_master"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    origin = Column(String(20), nullable=False)  # domestic, imported
    manufacturer = Column(String(50), nullable=False)
    model_group = Column(String(100), nullable=False)
    model_detail = Column(String(100), nullable=True)
    vehicle_class = Column(String(20), nullable=False)  # compact, small, mid, large, suv, sports, supercar
    start_year = Column(Integer, nullable=False)
    end_year = Column(Integer, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<VehicleMaster(id={self.id}, manufacturer={self.manufacturer}, model_group={self.model_group})>"

