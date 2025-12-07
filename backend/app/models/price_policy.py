"""
가격 정책 모델
"""
from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class PricePolicy(Base):
    """가격 정책 모델"""
    __tablename__ = "price_policies"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    origin = Column(String(20), nullable=False)  # domestic, imported
    vehicle_class = Column(String(20), nullable=False)  # compact, small, mid, large, suv, sports, supercar
    add_amount = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<PricePolicy(id={self.id}, origin={self.origin}, vehicle_class={self.vehicle_class}, add_amount={self.add_amount})>"

