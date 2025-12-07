"""
진단 신청 모델
"""
from sqlalchemy import Column, String, Integer, Date, Time, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class Inspection(Base):
    """진단 신청 모델"""
    __tablename__ = "inspections"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    inspector_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False)
    package_id = Column(UUID(as_uuid=True), ForeignKey("packages.id", ondelete="RESTRICT"), nullable=False)
    status = Column(String(20), nullable=False, default="requested")  # requested, paid, assigned, in_progress, completed, cancelled
    schedule_date = Column(Date, nullable=False)
    schedule_time = Column(Time, nullable=False)
    location_address = Column(Text, nullable=False)
    total_amount = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="inspections")
    inspector = relationship("User", foreign_keys=[inspector_id])
    # vehicle = relationship("Vehicle", back_populates="inspections")  # Vehicle 모델 생성 후 활성화
    package = relationship("Package")
    payment = relationship("Payment", back_populates="inspection", uselist=False)
    
    def __repr__(self):
        return f"<Inspection(id={self.id}, user_id={self.user_id}, status={self.status}, total_amount={self.total_amount})>"

