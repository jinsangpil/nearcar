"""
정산 모델
"""
from sqlalchemy import Column, String, Integer, Numeric, Date, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class Settlement(Base):
    """정산 모델"""
    __tablename__ = "settlements"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inspector_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    inspection_id = Column(UUID(as_uuid=True), ForeignKey("inspections.id", ondelete="CASCADE"), nullable=False, unique=True)
    total_sales = Column(Integer, nullable=False)
    fee_rate = Column(Numeric(5, 2), nullable=False)  # 스냅샷 저장
    settle_amount = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # pending, completed
    settle_date = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    inspector = relationship("User", foreign_keys=[inspector_id])
    inspection = relationship("Inspection", foreign_keys=[inspection_id])
    
    def __repr__(self):
        return f"<Settlement(id={self.id}, inspector_id={self.inspector_id}, settle_amount={self.settle_amount}, status={self.status})>"

