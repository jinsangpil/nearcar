"""
진단 레포트 모델
"""
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class InspectionReport(Base):
    """진단 레포트 모델"""
    __tablename__ = "inspection_reports"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inspection_id = Column(UUID(as_uuid=True), ForeignKey("inspections.id", ondelete="CASCADE"), nullable=False, unique=True)
    checklist_data = Column(JSONB, nullable=False, default={})
    images = Column(JSONB, default=[])
    videos = Column(JSONB, default=[])
    inspector_comment = Column(Text, nullable=True)
    repair_cost_est = Column(Integer, nullable=True)
    pdf_url = Column(String(255), nullable=True)
    status = Column(String(20), nullable=False, default="submitted")  # submitted, reviewed, rejected
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    inspection = relationship("Inspection", back_populates="report")
    
    def __repr__(self):
        return f"<InspectionReport(id={self.id}, inspection_id={self.inspection_id}, status={self.status})>"

