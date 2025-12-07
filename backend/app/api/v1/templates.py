"""
알림 템플릿 관리 API 엔드포인트
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from uuid import UUID

from app.core.database import get_db
from app.core.dependencies import require_role
from app.schemas.notification import NotificationTemplateCreateRequest, NotificationTemplateResponse
from app.schemas.vehicle import StandardResponse
from app.models.user import User
from app.services.notification_template_service import NotificationTemplateService

router = APIRouter(prefix="/templates", tags=["알림 템플릿"])


@router.post("", response_model=StandardResponse)
async def create_template(
    request: NotificationTemplateCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))  # 관리자/직원만 생성 가능
):
    """
    알림 템플릿 생성 API
    """
    try:
        template_service = NotificationTemplateService()
        template = await template_service.create_template(
            db=db,
            name=request.name,
            channel=request.channel,
            content=request.content,
            template_id=request.template_id if hasattr(request, 'template_id') else None,
            subject=request.subject if hasattr(request, 'subject') else None,
            variables=request.variables if hasattr(request, 'variables') else None
        )
        
        return StandardResponse(
            success=True,
            data=NotificationTemplateResponse(
                id=template.id,
                name=template.name,
                channel=template.channel,
                template_id=template.template_id,
                subject=template.subject,
                content=template.content,
                variables=template.variables or [],
                created_at=template.created_at,
                updated_at=template.updated_at
            ),
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
            detail=f"템플릿 생성 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("", response_model=StandardResponse)
async def list_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"])),  # 관리자/직원만 조회 가능
    channel: Optional[str] = Query(None, description="채널 필터"),
    is_active: Optional[str] = Query(None, description="활성화 여부 필터")
):
    """
    알림 템플릿 목록 조회 API
    """
    try:
        template_service = NotificationTemplateService()
        templates = await template_service.list_templates(
            db=db,
            channel=channel,
            is_active=is_active
        )
        
        return StandardResponse(
            success=True,
            data=[
                NotificationTemplateResponse(
                    id=template.id,
                    name=template.name,
                    channel=template.channel,
                    template_id=template.template_id,
                    subject=template.subject,
                    content=template.content,
                    variables=template.variables or [],
                    created_at=template.created_at,
                    updated_at=template.updated_at
                )
                for template in templates
            ],
            error=None
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"템플릿 목록 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/{template_id}", response_model=StandardResponse)
async def get_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))  # 관리자/직원만 조회 가능
):
    """
    알림 템플릿 상세 조회 API
    """
    try:
        template_service = NotificationTemplateService()
        template = await template_service.get_template(db, template_id=str(template_id))
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="템플릿을 찾을 수 없습니다."
            )
        
        return StandardResponse(
            success=True,
            data=NotificationTemplateResponse(
                id=template.id,
                name=template.name,
                channel=template.channel,
                template_id=template.template_id,
                subject=template.subject,
                content=template.content,
                variables=template.variables or [],
                created_at=template.created_at,
                updated_at=template.updated_at
            ),
            error=None
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"템플릿 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.put("/{template_id}", response_model=StandardResponse)
async def update_template(
    template_id: UUID,
    request: NotificationTemplateCreateRequest,  # 재사용 (실제로는 UpdateRequest 스키마 필요)
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "staff"]))  # 관리자/직원만 수정 가능
):
    """
    알림 템플릿 업데이트 API
    """
    try:
        template_service = NotificationTemplateService()
        template = await template_service.update_template(
            db=db,
            template_id=str(template_id),
            name=request.name if hasattr(request, 'name') else None,
            content=request.content if hasattr(request, 'content') else None,
            template_id_external=request.template_id if hasattr(request, 'template_id') else None,
            subject=request.subject if hasattr(request, 'subject') else None,
            variables=request.variables if hasattr(request, 'variables') else None
        )
        
        return StandardResponse(
            success=True,
            data=NotificationTemplateResponse(
                id=template.id,
                name=template.name,
                channel=template.channel,
                template_id=template.template_id,
                subject=template.subject,
                content=template.content,
                variables=template.variables or [],
                created_at=template.created_at,
                updated_at=template.updated_at
            ),
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
            detail=f"템플릿 업데이트 중 오류가 발생했습니다: {str(e)}"
        )


@router.delete("/{template_id}", response_model=StandardResponse)
async def delete_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin"]))  # 최고 관리자만 삭제 가능
):
    """
    알림 템플릿 삭제 API
    """
    try:
        template_service = NotificationTemplateService()
        await template_service.delete_template(db, template_id=str(template_id))
        
        return StandardResponse(
            success=True,
            message="템플릿이 성공적으로 삭제되었습니다.",
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
            detail=f"템플릿 삭제 중 오류가 발생했습니다: {str(e)}"
        )

