"""
차량 모델
"""
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class Vehicle(Base):
    """차량 모델"""
    __tablename__ = "vehicles"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    master_id = Column(UUID(as_uuid=True), ForeignKey("vehicle_master.id", ondelete="RESTRICT"), nullable=False)
    plate_number = Column(String(20), nullable=False)
    production_year = Column(Integer, nullable=False)
    fuel_type = Column(String(20), nullable=False)  # gasoline, diesel, electric, hybrid, lpg, cng
    owner_change_cnt = Column(Integer, nullable=False, default=0)
    is_flooded = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="vehicles")
    master = relationship("VehicleMaster")
    inspections = relationship("Inspection", back_populates="vehicle")
    
    def __repr__(self):
        return f"<Vehicle(id={self.id}, plate_number={self.plate_number}, production_year={self.production_year})>"

