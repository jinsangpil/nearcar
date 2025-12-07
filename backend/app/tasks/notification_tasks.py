"""
알림 발송 Celery Tasks
"""
from celery import Task
from typing import Dict, Any, Optional
from loguru import logger

from app.core.celery_app import celery_app
from app.services.notification_service import NotificationService
from app.core.database import AsyncSessionLocal
import asyncio


class NotificationTask(Task):
    """알림 발송 Task 기본 클래스"""
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Task 실패 시 호출"""
        logger.error(f"알림 발송 Task 실패: {task_id}, 오류: {exc}")
        super().on_failure(exc, task_id, args, kwargs, einfo)
    
    def on_success(self, retval, task_id, args, kwargs):
        """Task 성공 시 호출"""
        logger.info(f"알림 발송 Task 성공: {task_id}")
        super().on_success(retval, task_id, args, kwargs)


@celery_app.task(
    bind=True,
    base=NotificationTask,
    name="send_notification_task",
    max_retries=3,
    default_retry_delay=60
)
def send_notification_task(
    self,
    user_id: str,
    channel: str,
    template_id: Optional[str] = None,
    template_name: Optional[str] = None,
    data: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    알림 발송 Celery Task
    
    Args:
        user_id: 수신자 사용자 ID
        channel: 발송 채널 (alimtalk, sms, email, slack)
        template_id: 템플릿 ID (선택적)
        template_name: 템플릿 이름 (선택적, template_id 대신 사용)
        data: 템플릿 변수 데이터 (선택적)
    
    Returns:
        발송 결과
    """
    try:
        logger.info(f"알림 발송 시작: user_id={user_id}, channel={channel}")
        
        # async 함수를 동기적으로 실행
        async def _send():
            async with AsyncSessionLocal() as db:
                result = await NotificationService.send_notification(
                    db=db,
                    user_id=user_id,
                    channel=channel,
                    template_id=template_id,
                    template_name=template_name,
                    data=data or {}
                )
                return result
        
        result = asyncio.run(_send())
        
        logger.info(f"알림 발송 완료: user_id={user_id}, channel={channel}")
        return result
        
    except Exception as e:
        logger.error(f"알림 발송 실패: user_id={user_id}, channel={channel}, 오류: {str(e)}")
        # 재시도 (Exponential Backoff)
        retry_count = self.request.retries
        countdown = 60 * (2 ** retry_count)  # 60초, 120초, 240초
        raise self.retry(exc=e, countdown=countdown)

