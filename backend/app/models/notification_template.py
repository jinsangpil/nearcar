"""
알림 템플릿 모델
"""
from sqlalchemy import Column, String, Text, DateTime, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class NotificationTemplate(Base):
    """알림 템플릿 모델"""
    __tablename__ = "notification_templates"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False, unique=True)
    channel = Column(String(20), nullable=False)  # alimtalk, sms, email
    template_id = Column(String(50), nullable=True)  # 외부 서비스 템플릿 ID (카카오 알림톡 등)
    subject = Column(String(200), nullable=True)  # 이메일 제목 (이메일 채널용)
    content = Column(Text, nullable=False)  # Jinja2 템플릿 형식
    variables = Column(ARRAY(String), default=[])  # 사용 가능한 변수 목록
    is_active = Column(String(10), nullable=False, default="true")  # 활성화 여부
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<NotificationTemplate(id={self.id}, name={self.name}, channel={self.channel})>"

