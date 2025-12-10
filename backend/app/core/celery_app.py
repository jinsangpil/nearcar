"""
Celery 애플리케이션 설정
"""
from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

# Celery 앱 생성
celery_app = Celery(
    "nearcar",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.tasks.pdf_tasks",
        "app.tasks.notification_tasks",
        "app.tasks.settlement_tasks"
    ]
)

# Celery 설정
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Seoul",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30분
    task_soft_time_limit=25 * 60,  # 25분
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    # 재시도 설정
    task_default_retry_delay=60,  # 1분
    task_max_retries=3,
    # 결과 만료 시간
    result_expires=3600,  # 1시간
    # Celery Beat 스케줄 설정
    beat_schedule={
        'calculate-settlements-daily': {
            'task': 'calculate_settlements_daily',
            'schedule': crontab(hour=0, minute=0),  # 매일 자정 (00:00)에 실행
        },
    },
)

