"""
파일 업로드 관련 Pydantic 스키마
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from uuid import UUID


class PresignedUrlRequest(BaseModel):
    """Presigned URL 생성 요청 스키마"""
    inspection_id: UUID = Field(..., description="진단 신청 ID")
    section: str = Field(..., description="체크리스트 섹션 (exterior, engine, underbody, interior, electronics)")
    item_id: str = Field(..., description="체크리스트 항목 ID")
    file_name: str = Field(..., description="업로드할 파일명")
    content_type: str = Field(default="image/jpeg", description="파일 MIME 타입")


class PresignedUrlResponse(BaseModel):
    """Presigned URL 생성 응답 스키마"""
    presigned_url: str = Field(..., description="S3 Presigned URL")
    metadata: Dict[str, Any] = Field(..., description="이미지 메타데이터")


class UploadCallbackRequest(BaseModel):
    """업로드 완료 콜백 요청 스키마"""
    inspection_id: UUID = Field(..., description="진단 신청 ID")
    upload_id: str = Field(..., description="업로드 추적용 고유 ID")
    s3_key: str = Field(..., description="S3 객체 키")
    s3_url: str = Field(..., description="S3 객체 URL")
    section: str = Field(..., description="체크리스트 섹션")
    item_id: str = Field(..., description="체크리스트 항목 ID")
    file_name: str = Field(..., description="파일명")
    content_type: str = Field(default="image/jpeg", description="파일 MIME 타입")


class UploadCallbackResponse(BaseModel):
    """업로드 완료 콜백 응답 스키마"""
    success: bool = Field(..., description="성공 여부")
    image_id: str = Field(..., description="저장된 이미지 ID (upload_id)")
    message: str = Field(..., description="응답 메시지")


class ImageListResponse(BaseModel):
    """이미지 목록 조회 응답 스키마"""
    images: list[Dict[str, Any]] = Field(..., description="이미지 목록")
    total: int = Field(..., description="총 이미지 개수")

