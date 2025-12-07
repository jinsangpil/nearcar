"""
파일 업로드 API 엔드포인트
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from uuid import UUID

from app.core.database import get_db
from app.core.dependencies import require_role, get_current_user
from app.schemas.upload import (
    PresignedUrlRequest,
    PresignedUrlResponse,
    UploadCallbackRequest,
    UploadCallbackResponse,
    ImageListResponse
)
from app.schemas.vehicle import StandardResponse
from app.models.user import User
from app.services.upload_service import UploadService

router = APIRouter(prefix="/uploads", tags=["파일 업로드"])


@router.post("/presigned", response_model=StandardResponse)
async def generate_presigned_url(
    request: PresignedUrlRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["inspector", "admin", "staff"]))  # 기사/관리자만 업로드 가능
):
    """
    S3 Presigned URL 생성 API
    
    클라이언트가 S3에 직접 업로드할 수 있는 Presigned URL을 생성합니다.
    """
    try:
        upload_service = UploadService()
        result = upload_service.generate_presigned_url(
            inspection_id=request.inspection_id,
            section=request.section,
            item_id=request.item_id,
            file_name=request.file_name,
            content_type=request.content_type
        )
        
        return StandardResponse(
            success=True,
            data=PresignedUrlResponse(**result),
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
            detail=f"Presigned URL 생성 중 오류가 발생했습니다: {str(e)}"
        )


@router.post("/callback", response_model=StandardResponse)
async def upload_callback(
    request: UploadCallbackRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["inspector", "admin", "staff"]))  # 기사/관리자만 콜백 가능
):
    """
    업로드 완료 콜백 API
    
    클라이언트가 S3에 업로드를 완료한 후 호출하는 콜백 엔드포인트입니다.
    이미지 메타데이터를 DB에 저장합니다.
    """
    try:
        upload_service = UploadService()
        image_data = await upload_service.register_uploaded_image(
            db=db,
            inspection_id=request.inspection_id,
            metadata={
                "s3_key": request.s3_key,
                "s3_url": request.s3_url,
                "section": request.section,
                "item_id": request.item_id,
                "file_name": request.file_name,
                "content_type": request.content_type,
                "upload_id": request.upload_id
            }
        )
        
        return StandardResponse(
            success=True,
            data=UploadCallbackResponse(
                success=True,
                image_id=image_data.get("upload_id"),
                message="이미지 업로드가 완료되었습니다."
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
            detail=f"업로드 콜백 처리 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/inspections/{inspection_id}/images", response_model=StandardResponse)
async def get_uploaded_images(
    inspection_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),  # 관련 사용자 모두 조회 가능
    section: Optional[str] = Query(None, description="섹션 필터 (exterior, engine, underbody, interior, electronics)"),
    item_id: Optional[str] = Query(None, description="항목 ID 필터")
):
    """
    업로드된 이미지 목록 조회 API
    
    특정 진단 신청에 대한 업로드된 이미지 목록을 조회합니다.
    """
    try:
        upload_service = UploadService()
        images = await upload_service.get_uploaded_images(
            db=db,
            inspection_id=inspection_id,
            section=section,
            item_id=item_id
        )
        
        return StandardResponse(
            success=True,
            data=ImageListResponse(
                images=images,
                total=len(images)
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
            detail=f"이미지 목록 조회 중 오류가 발생했습니다: {str(e)}"
        )

