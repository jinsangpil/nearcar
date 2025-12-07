"""
결제 모델
"""
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class Payment(Base):
    """결제 모델"""
    __tablename__ = "payments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inspection_id = Column(UUID(as_uuid=True), ForeignKey("inspections.id", ondelete="CASCADE"), nullable=False, unique=True)
    amount = Column(Integer, nullable=False)
    method = Column(String(20), nullable=False)  # card, bank_transfer, virtual_account
    pg_provider = Column(String(20), nullable=False, default="toss")  # toss, iamport, kcp
    transaction_id = Column(String(100), unique=True)  # PG사 거래 고유 번호
    status = Column(String(20), nullable=False, default="pending")  # pending, paid, failed, cancelled, refunded
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationship
    inspection = relationship("Inspection", back_populates="payment")
    
    def __repr__(self):
        return f"<Payment(id={self.id}, inspection_id={self.inspection_id}, amount={self.amount}, status={self.status})>"

