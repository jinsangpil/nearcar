"""
사진 업로드 서비스
S3 Presigned URL 생성 및 이미지 메타데이터 관리
"""
import boto3
from botocore.exceptions import ClientError
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from uuid import UUID
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.models.inspection_report import InspectionReport
from app.models.inspection import Inspection
from loguru import logger


class UploadService:
    """사진 업로드 서비스"""
    
    def __init__(self):
        """S3 클라이언트 초기화"""
        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_REGION
            )
        else:
            # 자격 증명이 없으면 환경 변수나 IAM 역할 사용
            self.s3_client = boto3.client('s3', region_name=settings.AWS_REGION)
        
        self.bucket_name = settings.AWS_S3_BUCKET
    
    def generate_presigned_url(
        self,
        inspection_id: UUID,
        section: str,
        item_id: str,
        file_name: str,
        content_type: str = "image/jpeg",
        expires_in: int = 3600  # 1시간
    ) -> Dict[str, Any]:
        """
        S3 Presigned URL 생성
        
        Args:
            inspection_id: 진단 신청 ID
            section: 체크리스트 섹션 (exterior, engine, underbody, interior, electronics)
            item_id: 체크리스트 항목 ID
            file_name: 업로드할 파일명
            content_type: 파일 MIME 타입
            expires_in: URL 만료 시간 (초)
        
        Returns:
            Presigned URL 및 메타데이터
        """
        try:
            # S3 키 생성: inspections/{inspection_id}/{section}/{item_id}/{timestamp}_{filename}
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            s3_key = f"inspections/{inspection_id}/{section}/{item_id}/{timestamp}_{file_name}"
            
            # Presigned URL 생성
            presigned_url = self.s3_client.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': s3_key,
                    'ContentType': content_type,
                },
                ExpiresIn=expires_in
            )
            
            # 업로드 완료 후 사용할 메타데이터
            metadata = {
                "s3_key": s3_key,
                "s3_url": f"https://{self.bucket_name}.s3.{settings.AWS_REGION}.amazonaws.com/{s3_key}",
                "section": section,
                "item_id": item_id,
                "file_name": file_name,
                "content_type": content_type,
                "upload_id": str(uuid.uuid4()),  # 업로드 추적용 고유 ID
                "expires_at": (datetime.now() + timedelta(seconds=expires_in)).isoformat()
            }
            
            return {
                "presigned_url": presigned_url,
                "metadata": metadata
            }
        
        except ClientError as e:
            logger.error(f"S3 Presigned URL 생성 실패: {e}")
            raise ValueError(f"S3 Presigned URL 생성 실패: {str(e)}")
    
    async def register_uploaded_image(
        self,
        db: AsyncSession,
        inspection_id: UUID,
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        업로드 완료된 이미지 메타데이터를 DB에 저장
        
        Args:
            db: 데이터베이스 세션
            inspection_id: 진단 신청 ID
            metadata: 이미지 메타데이터 (s3_key, section, item_id 등)
        
        Returns:
            저장된 이미지 정보
        """
        try:
            # Inspection 조회
            inspection_stmt = select(Inspection).where(Inspection.id == inspection_id)
            inspection_result = await db.execute(inspection_stmt)
            inspection = inspection_result.scalars().first()
            
            if not inspection:
                raise ValueError("진단 신청을 찾을 수 없습니다.")
            
            # InspectionReport 조회 또는 생성
            report_stmt = select(InspectionReport).where(
                InspectionReport.inspection_id == inspection_id
            )
            report_result = await db.execute(report_stmt)
            report = report_result.scalars().first()
            
            if not report:
                # 레포트가 없으면 생성
                report = InspectionReport(
                    id=uuid.uuid4(),
                    inspection_id=inspection_id,
                    checklist_data={},
                    images=[],
                    status="submitted"
                )
                db.add(report)
                await db.flush()
            
            # images 배열에 이미지 메타데이터 추가
            images = report.images if report.images else []
            
            # 중복 체크 (같은 s3_key가 이미 있는지)
            existing_image = next(
                (img for img in images if img.get("s3_key") == metadata.get("s3_key")),
                None
            )
            
            if existing_image:
                logger.warning(f"이미 등록된 이미지: {metadata.get('s3_key')}")
                return existing_image
            
            # 항목별 최대 5장 제한 체크
            section = metadata.get("section")
            item_id = metadata.get("item_id")
            section_item_images = [
                img for img in images
                if img.get("section") == section and img.get("item_id") == item_id
            ]
            
            if len(section_item_images) >= 5:
                raise ValueError(f"{section}/{item_id} 항목에는 최대 5장까지만 업로드 가능합니다.")
            
            # 이미지 메타데이터 추가
            image_data = {
                "s3_key": metadata.get("s3_key"),
                "s3_url": metadata.get("s3_url"),
                "section": section,
                "item_id": item_id,
                "file_name": metadata.get("file_name"),
                "content_type": metadata.get("content_type"),
                "upload_id": metadata.get("upload_id"),
                "uploaded_at": datetime.now().isoformat()
            }
            
            images.append(image_data)
            report.images = images
            
            await db.commit()
            await db.refresh(report)
            
            logger.info(f"이미지 메타데이터 저장 완료: {image_data.get('s3_key')}")
            
            return image_data
        
        except ValueError:
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"이미지 메타데이터 저장 실패: {e}")
            raise ValueError(f"이미지 메타데이터 저장 실패: {str(e)}")
    
    async def get_uploaded_images(
        self,
        db: AsyncSession,
        inspection_id: UUID,
        section: Optional[str] = None,
        item_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        업로드된 이미지 목록 조회
        
        Args:
            db: 데이터베이스 세션
            inspection_id: 진단 신청 ID
            section: 필터링할 섹션 (선택적)
            item_id: 필터링할 항목 ID (선택적)
        
        Returns:
            이미지 목록
        """
        try:
            report_stmt = select(InspectionReport).where(
                InspectionReport.inspection_id == inspection_id
            )
            report_result = await db.execute(report_stmt)
            report = report_result.scalars().first()
            
            if not report or not report.images:
                return []
            
            images = report.images if isinstance(report.images, list) else []
            
            # 필터링
            if section:
                images = [img for img in images if img.get("section") == section]
            if item_id:
                images = [img for img in images if img.get("item_id") == item_id]
            
            return images
        
        except Exception as e:
            logger.error(f"이미지 목록 조회 실패: {e}")
            raise ValueError(f"이미지 목록 조회 실패: {str(e)}")
    
    def generate_presigned_download_url(
        self,
        s3_key: str,
        expires_in: int = 3600  # 1시간
    ) -> str:
        """
        이미지 다운로드를 위한 Presigned URL 생성
        
        Args:
            s3_key: S3 객체 키
            expires_in: URL 만료 시간 (초)
        
        Returns:
            Presigned 다운로드 URL
        """
        try:
            presigned_url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': s3_key,
                },
                ExpiresIn=expires_in
            )
            return presigned_url
        
        except ClientError as e:
            logger.error(f"S3 Presigned 다운로드 URL 생성 실패: {e}")
            raise ValueError(f"S3 Presigned 다운로드 URL 생성 실패: {str(e)}")

