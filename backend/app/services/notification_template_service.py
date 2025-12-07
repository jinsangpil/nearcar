"""
알림 템플릿 관리 서비스
"""
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from jinja2 import Template, TemplateError
import uuid

from app.models.notification_template import NotificationTemplate
from loguru import logger


class NotificationTemplateService:
    """알림 템플릿 관리 서비스"""
    
    @staticmethod
    async def create_template(
        db: AsyncSession,
        name: str,
        channel: str,
        content: str,
        template_id: Optional[str] = None,
        subject: Optional[str] = None,
        variables: Optional[List[str]] = None
    ) -> NotificationTemplate:
        """
        알림 템플릿 생성
        
        Args:
            db: 데이터베이스 세션
            name: 템플릿 이름
            channel: 채널 (alimtalk, sms, email)
            content: Jinja2 템플릿 내용
            template_id: 외부 서비스 템플릿 ID
            subject: 이메일 제목 (이메일 채널용)
            variables: 사용 가능한 변수 목록
        
        Returns:
            생성된 템플릿
        """
        # 템플릿 이름 중복 체크
        existing = await db.execute(
            select(NotificationTemplate).where(NotificationTemplate.name == name)
        )
        if existing.scalar_one_or_none():
            raise ValueError(f"템플릿 이름 '{name}'이 이미 존재합니다.")
        
        # Jinja2 템플릿 유효성 검사
        try:
            Template(content)
        except TemplateError as e:
            raise ValueError(f"템플릿 문법 오류: {str(e)}")
        
        template = NotificationTemplate(
            id=uuid.uuid4(),
            name=name,
            channel=channel,
            template_id=template_id,
            subject=subject,
            content=content,
            variables=variables or [],
            is_active="true"
        )
        
        db.add(template)
        await db.commit()
        await db.refresh(template)
        
        logger.info(f"알림 템플릿 생성: {template.id} ({name})")
        return template
    
    @staticmethod
    async def get_template(
        db: AsyncSession,
        template_id: Optional[str] = None,
        name: Optional[str] = None
    ) -> Optional[NotificationTemplate]:
        """
        알림 템플릿 조회
        
        Args:
            db: 데이터베이스 세션
            template_id: 템플릿 ID
            name: 템플릿 이름
        
        Returns:
            템플릿 또는 None
        """
        if template_id:
            result = await db.execute(
                select(NotificationTemplate).where(NotificationTemplate.id == template_id)
            )
        elif name:
            result = await db.execute(
                select(NotificationTemplate).where(NotificationTemplate.name == name)
            )
        else:
            raise ValueError("template_id 또는 name 중 하나는 필수입니다.")
        
        return result.scalar_one_or_none()
    
    @staticmethod
    async def list_templates(
        db: AsyncSession,
        channel: Optional[str] = None,
        is_active: Optional[str] = None
    ) -> List[NotificationTemplate]:
        """
        알림 템플릿 목록 조회
        
        Args:
            db: 데이터베이스 세션
            channel: 채널 필터
            is_active: 활성화 여부 필터
        
        Returns:
            템플릿 목록
        """
        query = select(NotificationTemplate)
        
        conditions = []
        if channel:
            conditions.append(NotificationTemplate.channel == channel)
        if is_active:
            conditions.append(NotificationTemplate.is_active == is_active)
        
        if conditions:
            query = query.where(and_(*conditions))
        
        result = await db.execute(query)
        return result.scalars().all()
    
    @staticmethod
    async def update_template(
        db: AsyncSession,
        template_id: str,
        name: Optional[str] = None,
        content: Optional[str] = None,
        template_id_external: Optional[str] = None,
        subject: Optional[str] = None,
        variables: Optional[List[str]] = None,
        is_active: Optional[str] = None
    ) -> NotificationTemplate:
        """
        알림 템플릿 업데이트
        
        Args:
            db: 데이터베이스 세션
            template_id: 템플릿 ID
            name: 템플릿 이름
            content: Jinja2 템플릿 내용
            template_id_external: 외부 서비스 템플릿 ID
            subject: 이메일 제목
            variables: 사용 가능한 변수 목록
            is_active: 활성화 여부
        
        Returns:
            업데이트된 템플릿
        """
        template = await NotificationTemplateService.get_template(db, template_id=template_id)
        if not template:
            raise ValueError("템플릿을 찾을 수 없습니다.")
        
        if name and name != template.name:
            # 이름 중복 체크
            existing = await db.execute(
                select(NotificationTemplate).where(
                    and_(
                        NotificationTemplate.name == name,
                        NotificationTemplate.id != template_id
                    )
                )
            )
            if existing.scalar_one_or_none():
                raise ValueError(f"템플릿 이름 '{name}'이 이미 존재합니다.")
            template.name = name
        
        if content:
            # Jinja2 템플릿 유효성 검사
            try:
                Template(content)
            except TemplateError as e:
                raise ValueError(f"템플릿 문법 오류: {str(e)}")
            template.content = content
        
        if template_id_external is not None:
            template.template_id = template_id_external
        if subject is not None:
            template.subject = subject
        if variables is not None:
            template.variables = variables
        if is_active is not None:
            template.is_active = is_active
        
        await db.commit()
        await db.refresh(template)
        
        logger.info(f"알림 템플릿 업데이트: {template.id}")
        return template
    
    @staticmethod
    async def delete_template(
        db: AsyncSession,
        template_id: str
    ) -> bool:
        """
        알림 템플릿 삭제
        
        Args:
            db: 데이터베이스 세션
            template_id: 템플릿 ID
        
        Returns:
            삭제 성공 여부
        """
        template = await NotificationTemplateService.get_template(db, template_id=template_id)
        if not template:
            raise ValueError("템플릿을 찾을 수 없습니다.")
        
        await db.delete(template)
        await db.commit()
        
        logger.info(f"알림 템플릿 삭제: {template_id}")
        return True
    
    @staticmethod
    def render_template(
        template_content: str,
        variables: Dict[str, Any]
    ) -> str:
        """
        Jinja2 템플릿 렌더링
        
        Args:
            template_content: Jinja2 템플릿 내용
            variables: 템플릿 변수
        
        Returns:
            렌더링된 내용
        """
        try:
            template = Template(template_content)
            return template.render(**variables)
        except TemplateError as e:
            logger.error(f"템플릿 렌더링 실패: {e}")
            raise ValueError(f"템플릿 렌더링 실패: {str(e)}")

