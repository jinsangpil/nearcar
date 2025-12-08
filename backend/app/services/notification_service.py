"""
알림 서비스
템플릿 관리 및 채널별 발송 통합
"""
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, desc
from datetime import datetime
import uuid

from app.models.notification import Notification
from app.models.user import User
from app.services.notification_template_service import NotificationTemplateService
from app.services.channel_service import ChannelService
from loguru import logger


class NotificationService:
    """알림 서비스 (기초 작업)"""
    
    @staticmethod
    async def send_notification(
        db: AsyncSession,
        user_id: str,
        channel: str,
        template_id: Optional[str] = None,
        template_name: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        알림 발송 (템플릿 기반)
        
        Args:
            db: 데이터베이스 세션
            user_id: 수신자 ID
            channel: 채널 (alimtalk, sms, email, slack)
            template_id: 템플릿 ID
            template_name: 템플릿 이름 (template_id 대신 사용 가능)
            data: 템플릿 변수 데이터
        
        Returns:
            생성된 Notification 정보
        """
        # 사용자 확인
        user_uuid = uuid.UUID(user_id) if isinstance(user_id, str) else user_id
        user_result = await db.execute(
            select(User).where(User.id == user_uuid)
        )
        user = user_result.scalar_one_or_none()
        
        if not user:
            raise ValueError("사용자를 찾을 수 없습니다")
        
        # 템플릿 조회
        template = None
        if template_id:
            template = await NotificationTemplateService.get_template(db, template_id=template_id)
        elif template_name:
            template = await NotificationTemplateService.get_template(db, name=template_name)
        
        # 템플릿이 있으면 템플릿 내용 렌더링
        if template:
            if template.channel != channel:
                raise ValueError(f"템플릿 채널({template.channel})과 요청 채널({channel})이 일치하지 않습니다.")
            
            if template.is_active != "true":
                raise ValueError("비활성화된 템플릿입니다.")
            
            # Jinja2 템플릿 렌더링
            content = NotificationTemplateService.render_template(
                template.content,
                data or {}
            )
            subject = template.subject
            external_template_id = template.template_id
        else:
            # 템플릿이 없으면 기본 내용 사용
            content = f"알림: {template_id or template_name or 'default'}"
            if data:
                content += f"\n{data}"
            subject = None
            external_template_id = template_id
        
        # Notification 생성
        notification = Notification(
            user_id=user_uuid,
            channel=channel,
            template_id=external_template_id or template_id,
            content=content,
            status="pending"
        )
        
        db.add(notification)
        await db.flush()
        
        # 채널별 발송 시도
        try:
            if channel == "alimtalk":
                # 전화번호 필요 (user.phone 복호화 필요)
                from app.core.security import decrypt_phone
                phone = decrypt_phone(user.phone) if user.phone else None
                if not phone:
                    raise ValueError("사용자 전화번호가 없습니다.")
                
                result = await ChannelService.send_alimtalk(
                    phone_number=phone,
                    template_code=external_template_id or "",
                    content=content,
                    variables=data
                )
            elif channel == "sms":
                from app.core.security import decrypt_phone
                phone = decrypt_phone(user.phone) if user.phone else None
                if not phone:
                    raise ValueError("사용자 전화번호가 없습니다.")
                
                result = await ChannelService.send_sms(
                    phone_number=phone,
                    content=content,
                    title=subject
                )
            elif channel == "email":
                if not user.email:
                    raise ValueError("사용자 이메일이 없습니다.")
                result = await ChannelService.send_email(
                    email=user.email,
                    subject=subject or "NearCar 알림",
                    content=content
                )
            elif channel == "slack":
                result = await ChannelService.send_slack(message=content)
            else:
                raise ValueError(f"지원하지 않는 채널: {channel}")
            
            # 발송 성공 시 상태 업데이트
            notification.status = "sent"
            notification.sent_at = datetime.now()
            logger.info(f"Notification {notification.id} sent successfully via {channel}")
        
        except Exception as e:
            # 발송 실패 시 상태 업데이트
            notification.status = "failed"
            logger.error(f"Notification {notification.id} send failed: {e}")
            # 실패해도 Notification 레코드는 저장
        
        await db.commit()
        await db.refresh(notification)
        
        return {
            "notification_id": notification.id,
            "status": notification.status
        }
    
    @staticmethod
    async def get_notification_status(
        db: AsyncSession,
        notification_id: int
    ) -> Optional[Dict[str, Any]]:
        """
        알림 상태 조회
        
        Args:
            db: 데이터베이스 세션
            notification_id: 알림 ID
        
        Returns:
            Notification 상태 정보
        """
        result = await db.execute(
            select(Notification).where(Notification.id == notification_id)
        )
        notification = result.scalar_one_or_none()
        
        if not notification:
            return None
        
        return {
            "notification_id": notification.id,
            "status": notification.status,
            "channel": notification.channel,
            "created_at": notification.created_at.isoformat()
        }
    
    @staticmethod
    async def get_notification_history(
        db: AsyncSession,
        user_id: Optional[str] = None,
        channel: Optional[str] = None,
        status: Optional[str] = None,
        page: int = 1,
        limit: int = 20
    ) -> Dict[str, Any]:
        """
        알림 이력 조회
        
        Args:
            db: 데이터베이스 세션
            user_id: 사용자 ID 필터
            channel: 채널 필터
            status: 상태 필터
            page: 페이지 번호
            limit: 페이지 크기
        
        Returns:
            알림 이력 목록 및 페이지네이션 정보
        """
        # 기본 쿼리
        query = select(Notification)
        
        # 필터링
        conditions = []
        if user_id:
            conditions.append(Notification.user_id == user_id)
        if channel:
            conditions.append(Notification.channel == channel)
        if status:
            conditions.append(Notification.status == status)
        
        if conditions:
            query = query.where(and_(*conditions))
        
        # 정렬 (최신순)
        query = query.order_by(desc(Notification.created_at))
        
        # 전체 개수 조회
        count_query = select(func.count()).select_from(query.subquery())
        count_result = await db.execute(count_query)
        total = count_result.scalar_one()
        
        # 페이지네이션
        offset = (page - 1) * limit
        query = query.offset(offset).limit(limit)
        
        # 데이터 조회
        result = await db.execute(query)
        notifications = result.scalars().all()
        
        # 응답 데이터 구성
        notification_list = [
            {
                "id": notification.id,
                "user_id": str(notification.user_id),
                "channel": notification.channel,
                "template_id": notification.template_id,
                "content": notification.content,
                "status": notification.status,
                "created_at": notification.created_at.isoformat(),
                "sent_at": notification.sent_at.isoformat() if notification.sent_at else None
            }
            for notification in notifications
        ]
        
        return {
            "items": notification_list,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit
        }
    
    @staticmethod
    async def get_notification_stats(
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        알림 통계 조회
        
        Args:
            db: 데이터베이스 세션
        
        Returns:
            알림 통계 정보
        """
        # 전체 개수
        total_result = await db.execute(select(func.count(Notification.id)))
        total = total_result.scalar_one()
        
        # 채널별 개수
        channel_result = await db.execute(
            select(Notification.channel, func.count(Notification.id))
            .group_by(Notification.channel)
        )
        by_channel = {row[0]: row[1] for row in channel_result.all()}
        
        # 상태별 개수
        status_result = await db.execute(
            select(Notification.status, func.count(Notification.id))
            .group_by(Notification.status)
        )
        by_status = {row[0]: row[1] for row in status_result.all()}
        
        return {
            "total": total,
            "by_channel": by_channel,
            "by_status": by_status
        }

