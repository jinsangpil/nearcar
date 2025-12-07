"""
레포트 관련 API 엔드포인트
"""
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.schemas.vehicle import StandardResponse
from app.services.checklist_service import ChecklistService
from app.models.user import User

# PDF 생성 Task는 조건부 import
try:
    from app.tasks.pdf_tasks import generate_inspection_report_pdf
    PDF_GENERATION_AVAILABLE = True
except (ImportError, OSError):
    PDF_GENERATION_AVAILABLE = False
    generate_inspection_report_pdf = None

router = APIRouter(prefix="/reports", tags=["레포트"])


@router.post("/inspections/{inspection_id}/generate-pdf", response_model=StandardResponse)
async def generate_report_pdf(
    inspection_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    진단 레포트 PDF 생성 요청 API
    
    Celery Task를 통해 비동기로 PDF를 생성합니다.
    """
    if not PDF_GENERATION_AVAILABLE or not generate_inspection_report_pdf:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="PDF 생성 기능을 사용할 수 없습니다. WeasyPrint 시스템 라이브러리 설치가 필요합니다. README_CELERY.md를 참고하세요."
        )
    
    try:
        # 체크리스트 데이터 조회
        checklist = await ChecklistService.get_checklist(db, inspection_id)
        
        if not checklist:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="체크리스트를 찾을 수 없습니다. 먼저 체크리스트를 작성해주세요."
            )
        
        # Celery Task 실행
        task = generate_inspection_report_pdf.delay(
            inspection_id=inspection_id,
            report_data=checklist
        )
        
        return StandardResponse(
            success=True,
            data={
                "task_id": task.id,
                "inspection_id": inspection_id,
                "status": "processing",
                "message": "PDF 생성이 시작되었습니다. 완료되면 알림을 받으실 수 있습니다."
            },
            error=None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PDF 생성 요청 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/tasks/{task_id}/status", response_model=StandardResponse)
async def get_pdf_generation_status(
    task_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    PDF 생성 Task 상태 조회 API
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
                "message": "PDF 생성 중입니다...",
                "progress": task.info.get("progress", 0) if isinstance(task.info, dict) else None
            }
        elif task.state == "SUCCESS":
            response = {
                "task_id": task_id,
                "status": "completed",
                "message": "PDF 생성이 완료되었습니다.",
                "result": task.result
            }
        else:  # FAILURE
            response = {
                "task_id": task_id,
                "status": "failed",
                "message": "PDF 생성에 실패했습니다.",
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

