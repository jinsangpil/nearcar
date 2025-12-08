"""
알림 API 엔드포인트
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.schemas.notification import (
    NotificationSendRequest,
    NotificationStatusResponse,
    NotificationHistoryQuery,
    NotificationHistoryResponse,
    NotificationStatsResponse
)
from app.schemas.vehicle import StandardResponse
from app.services.notification_service import NotificationService
from app.tasks.notification_tasks import send_notification_task
from app.models.user import User

router = APIRouter(prefix="/notifications", tags=["알림"])


@router.post("/send", response_model=StandardResponse)
async def send_notification(
    request: NotificationSendRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    알림 발송 API
    
    Celery Task를 통해 비동기로 알림을 발송합니다.
    관리자 권한 필요.
    """
    try:
        # 유효성 검증
        if not request.user_id:
            raise ValueError("수신자 ID는 필수입니다")
        
        if request.channel not in ["alimtalk", "sms", "email", "slack"]:
            raise ValueError(f"지원하지 않는 채널입니다: {request.channel}")
        
        if not request.template_id and not getattr(request, 'template_name', None):
            # 템플릿이 없어도 기본 메시지로 발송 가능하도록 허용
            pass
        
        # Celery Task 실행
        task = send_notification_task.delay(
            user_id=request.user_id,
            channel=request.channel,
            template_id=request.template_id,
            template_name=request.template_name,
            data=request.data or {}
        )
        
        return StandardResponse(
            success=True,
            data={
                "task_id": task.id,
                "user_id": request.user_id,
                "channel": request.channel,
                "status": "processing",
                "message": "알림 발송이 시작되었습니다."
            },
            error=None
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"알림 발송 요청 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/status/{notification_id}", response_model=StandardResponse)
async def get_notification_status(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    알림 상태 조회 API
    
    알림의 현재 상태를 조회합니다.
    """
    try:
        status_data = await NotificationService.get_notification_status(
            db=db,
            notification_id=notification_id
        )
        
        if not status_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="알림을 찾을 수 없습니다"
            )
        
        return StandardResponse(
            success=True,
            data=status_data,
            error=None
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"알림 상태 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/tasks/{task_id}/status", response_model=StandardResponse)
async def get_notification_task_status(
    task_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    알림 발송 Task 상태 조회 API
    
    Celery Task의 현재 상태를 조회합니다.
    """
    from app.core.celery_app import celery_app
    
    try:
        task = celery_app.AsyncResult(task_id)
        
        if task.state == "PENDING":
            response = {
                "task_id": task_id,
                "status": "pending",
                "message": "작업이 대기 중입니다."
            }
        elif task.state == "PROGRESS":
            response = {
                "task_id": task_id,
                "status": "processing",
                "message": "알림 발송 중입니다...",
                "progress": task.info.get("progress", 0) if isinstance(task.info, dict) else None
            }
        elif task.state == "SUCCESS":
            response = {
                "task_id": task_id,
                "status": "completed",
                "message": "알림 발송이 완료되었습니다.",
                "result": task.result
            }
        else:  # FAILURE
            response = {
                "task_id": task_id,
                "status": "failed",
                "message": "알림 발송에 실패했습니다.",
                "error": str(task.info) if task.info else "알 수 없는 오류"
            }
        
        return StandardResponse(
            success=True,
            data=response,
            error=None
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Task 상태 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/history", response_model=StandardResponse)
async def get_notification_history(
    user_id: Optional[str] = Query(None, description="사용자 ID 필터"),
    channel: Optional[str] = Query(None, description="채널 필터"),
    status: Optional[str] = Query(None, description="상태 필터"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    limit: int = Query(20, ge=1, le=100, description="페이지 크기"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    알림 이력 조회 API
    
    알림 발송 이력을 조회합니다.
    필터링 및 페이지네이션 지원.
    관리자 권한 필요.
    """
    try:
        result = await NotificationService.get_notification_history(
            db=db,
            user_id=user_id,
            channel=channel,
            status=status,
            page=page,
            limit=limit
        )
        
        return StandardResponse(
            success=True,
            data=result,
            error=None
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"알림 이력 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/stats", response_model=StandardResponse)
async def get_notification_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))
):
    """
    알림 통계 API
    
    채널별, 상태별 알림 통계를 조회합니다.
    관리자 권한 필요.
    """
    try:
        stats = await NotificationService.get_notification_stats(db=db)
        
        return StandardResponse(
            success=True,
            data=stats,
            error=None
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"알림 통계 조회 중 오류가 발생했습니다: {str(e)}"
        )

