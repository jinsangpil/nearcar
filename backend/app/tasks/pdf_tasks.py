"""
PDF 생성 Celery Tasks
"""
from celery import Task
from typing import Dict, Any, Optional
import uuid
from datetime import datetime
from loguru import logger
import boto3
from botocore.exceptions import ClientError
try:
    from weasyprint import HTML, CSS
    from weasyprint.text.fonts import FontConfiguration
    WEASYPRINT_AVAILABLE = True
except (ImportError, OSError) as e:
    WEASYPRINT_AVAILABLE = False
    logger.warning(f"WeasyPrint를 사용할 수 없습니다. 시스템 라이브러리 설치가 필요합니다: {e}")
from jinja2 import Environment, FileSystemLoader, select_autoescape
import os

import asyncio
from app.core.celery_app import celery_app
from app.core.config import settings
from app.services.checklist_service import ChecklistService
from app.core.database import AsyncSessionLocal
from app.models.inspection_report import InspectionReport
from sqlalchemy import select


class PDFGenerationTask(Task):
    """PDF 생성 Task 기본 클래스"""
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Task 실패 시 호출"""
        logger.error(f"PDF 생성 Task 실패: {task_id}, 오류: {exc}")
        super().on_failure(exc, task_id, args, kwargs, einfo)
    
    def on_success(self, retval, task_id, args, kwargs):
        """Task 성공 시 호출"""
        logger.info(f"PDF 생성 Task 성공: {task_id}")
        super().on_success(retval, task_id, args, kwargs)


@celery_app.task(
    bind=True,
    base=PDFGenerationTask,
    name="generate_inspection_report_pdf",
    max_retries=3,
    default_retry_delay=60
)
def generate_inspection_report_pdf(
    self,
    inspection_id: str,
    report_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    진단 레포트 PDF 생성 Task
    
    Args:
        inspection_id: 진단 신청 ID
        report_data: 레포트 데이터 (체크리스트, 이미지, 의견 등)
    
    Returns:
        생성된 PDF의 S3 URL 및 메타데이터
    """
    try:
        if not WEASYPRINT_AVAILABLE:
            raise RuntimeError(
                "WeasyPrint를 사용할 수 없습니다. "
                "시스템 라이브러리 설치가 필요합니다. "
                "README_CELERY.md를 참고하세요."
            )
        
        logger.info(f"PDF 생성 시작: inspection_id={inspection_id}")
        
        # 1. HTML 템플릿 렌더링
        html_content = _render_pdf_template(inspection_id, report_data)
        
        # 2. PDF 생성
        pdf_bytes = _generate_pdf_from_html(html_content)
        
        # 3. S3 업로드
        pdf_url = _upload_pdf_to_s3(inspection_id, pdf_bytes)
        
        # 4. DB에 PDF URL 저장 (async 함수를 동기적으로 실행)
        asyncio.run(_update_report_pdf_url(inspection_id, pdf_url))
        
        # 5. PDF 생성 완료 알림 발송
        asyncio.run(_send_pdf_generation_notification(inspection_id, pdf_url))
        
        logger.info(f"PDF 생성 완료: inspection_id={inspection_id}, url={pdf_url}")
        
        return {
            "success": True,
            "inspection_id": inspection_id,
            "pdf_url": pdf_url,
            "file_size": len(pdf_bytes),
            "generated_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"PDF 생성 실패: inspection_id={inspection_id}, 오류: {str(e)}")
        # 재시도
        raise self.retry(exc=e, countdown=60)


def _render_pdf_template(inspection_id: str, report_data: Dict[str, Any]) -> str:
    """
    Jinja2 템플릿을 사용하여 HTML 렌더링
    
    Args:
        inspection_id: 진단 신청 ID
        report_data: 레포트 데이터
    
    Returns:
        렌더링된 HTML 문자열
    """
    # 템플릿 디렉토리 설정
    template_dir = os.path.join(os.path.dirname(__file__), "..", "templates", "pdf")
    os.makedirs(template_dir, exist_ok=True)
    
    # Jinja2 환경 설정
    env = Environment(
        loader=FileSystemLoader(template_dir),
        autoescape=select_autoescape(["html", "xml"])
    )
    
    # 기본 템플릿이 없으면 동적으로 생성
    template_path = os.path.join(template_dir, "inspection_report.html")
    if not os.path.exists(template_path):
        _create_default_template(template_path)
    
    template = env.get_template("inspection_report.html")
    
    # 템플릿 변수 준비
    template_vars = {
        "inspection_id": inspection_id,
        "report_data": report_data,
        "checklist_data": report_data.get("checklist_data", {}),
        "images": report_data.get("images", []),
        "inspector_comment": report_data.get("inspector_comment", ""),
        "repair_cost_est": report_data.get("repair_cost_est", 0),
        "generated_at": datetime.now().strftime("%Y년 %m월 %d일 %H:%M"),
        "sections": ["외관", "엔진룸", "하부", "실내", "전장품"]
    }
    
    return template.render(**template_vars)


def _generate_pdf_from_html(html_content: str) -> bytes:
    """
    HTML을 PDF로 변환
    
    Args:
        html_content: HTML 문자열
    
    Returns:
        PDF 바이트 데이터
    """
    font_config = FontConfiguration()
    
    # CSS 스타일
    css = CSS(string="""
        @page {
            size: A4;
            margin: 2cm;
        }
        body {
            font-family: "Noto Sans KR", "Malgun Gothic", sans-serif;
            font-size: 12pt;
            line-height: 1.6;
            color: #333;
        }
        h1 {
            color: #2563eb;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 10px;
            margin-bottom: 30px;
        }
        h2 {
            color: #1e40af;
            margin-top: 30px;
            margin-bottom: 15px;
            border-left: 4px solid #2563eb;
            padding-left: 10px;
        }
        .section {
            margin-bottom: 30px;
            page-break-inside: avoid;
        }
        .item {
            margin-bottom: 10px;
            padding: 8px;
            background-color: #f9fafb;
            border-radius: 4px;
        }
        .status-normal {
            color: #059669;
            font-weight: bold;
        }
        .status-warning {
            color: #d97706;
            font-weight: bold;
        }
        .status-error {
            color: #dc2626;
            font-weight: bold;
        }
        .image-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin-top: 10px;
        }
        .image-item {
            text-align: center;
            page-break-inside: avoid;
        }
        .image-item img {
            max-width: 100%;
            height: auto;
            border: 1px solid #e5e7eb;
            border-radius: 4px;
        }
        .comment-box {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            margin-top: 20px;
            border-radius: 4px;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 10pt;
        }
    """, font_config=font_config)
    
    html = HTML(string=html_content)
    pdf_bytes = html.write_pdf(stylesheets=[css], font_config=font_config)
    
    return pdf_bytes


def _upload_pdf_to_s3(inspection_id: str, pdf_bytes: bytes) -> str:
    """
    PDF를 S3에 업로드
    
    Args:
        inspection_id: 진단 신청 ID
        pdf_bytes: PDF 바이트 데이터
    
    Returns:
        업로드된 PDF의 S3 URL
    """
    if not settings.AWS_ACCESS_KEY_ID or not settings.AWS_SECRET_ACCESS_KEY:
        raise ValueError("AWS 자격 증명이 설정되지 않았습니다")
    
    s3_client = boto3.client(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION
    )
    
    # S3 키 생성
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    s3_key = f"reports/{inspection_id}/report_{timestamp}.pdf"
    
    try:
        # S3 업로드
        s3_client.put_object(
            Bucket=settings.AWS_S3_BUCKET,
            Key=s3_key,
            Body=pdf_bytes,
            ContentType="application/pdf",
            CacheControl="max-age=3600"
        )
        
        # 공개 URL 생성 (또는 Presigned URL)
        pdf_url = f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/{s3_key}"
        
        logger.info(f"PDF S3 업로드 완료: {s3_key}")
        return pdf_url
        
    except ClientError as e:
        logger.error(f"S3 업로드 실패: {e}")
        raise


async def _update_report_pdf_url(inspection_id: str, pdf_url: str):
    """
    InspectionReport의 pdf_url 업데이트
    
    Args:
        inspection_id: 진단 신청 ID
        pdf_url: 생성된 PDF의 S3 URL
    """
    import uuid
    
    # UUID 변환
    try:
        inspection_uuid = uuid.UUID(inspection_id)
    except ValueError:
        logger.error(f"올바른 진단 신청 ID 형식이 아닙니다: {inspection_id}")
        raise ValueError(f"올바른 진단 신청 ID 형식이 아닙니다: {inspection_id}")
    
    async with AsyncSessionLocal() as session:
        try:
            result = await session.execute(
                select(InspectionReport).where(InspectionReport.inspection_id == inspection_uuid)
            )
            report = result.scalar_one_or_none()
            
            if report:
                report.pdf_url = pdf_url
                await session.commit()
                logger.info(f"InspectionReport PDF URL 업데이트 완료: {inspection_id}")
            else:
                logger.warning(f"InspectionReport를 찾을 수 없습니다: {inspection_id}")
        except Exception as e:
            logger.error(f"PDF URL 업데이트 실패: {inspection_id}, 오류: {e}")
            await session.rollback()
            raise


async def _send_pdf_generation_notification(inspection_id: str, pdf_url: str):
    """
    PDF 생성 완료 알림 발송
    
    Args:
        inspection_id: 진단 신청 ID
        pdf_url: 생성된 PDF의 S3 URL
    """
    import uuid
    from app.models.inspection import Inspection
    
    # UUID 변환
    try:
        inspection_uuid = uuid.UUID(inspection_id)
    except ValueError:
        logger.error(f"올바른 진단 신청 ID 형식이 아닙니다: {inspection_id}")
        return
    
    async with AsyncSessionLocal() as session:
        try:
            # Inspection 조회하여 고객 정보 가져오기
            result = await session.execute(
                select(Inspection).where(Inspection.id == inspection_uuid)
            )
            inspection = result.scalar_one_or_none()
            
            if not inspection:
                logger.warning(f"Inspection을 찾을 수 없습니다: {inspection_id}")
                return
            
            # 알림 트리거 서비스 호출
            from app.services.notification_trigger_service import NotificationTriggerService
            
            NotificationTriggerService.trigger_pdf_generated(
                inspection_id=str(inspection_uuid),
                user_id=str(inspection.user_id),
                pdf_url=pdf_url
            )
            
            logger.info(f"PDF 생성 완료 알림 발송: inspection_id={inspection_id}")
            
        except Exception as e:
            logger.error(f"PDF 생성 완료 알림 발송 실패: {inspection_id}, 오류: {e}")
            # 알림 발송 실패는 PDF 생성 자체를 실패로 만들지 않음


def _create_default_template(template_path: str):
    """기본 PDF 템플릿 생성"""
    template_content = """<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>진단 레포트</title>
</head>
<body>
    <h1>중고차 진단 레포트</h1>
    
    <div class="info-section">
        <p><strong>진단 신청 ID:</strong> {{ inspection_id }}</p>
        <p><strong>생성 일시:</strong> {{ generated_at }}</p>
    </div>
    
    {% for section in sections %}
    <div class="section">
        <h2>{{ section }}</h2>
        {% if checklist_data.get(section) %}
            {% for item in checklist_data[section] %}
            <div class="item">
                <strong>{{ item.name }}</strong>
                {% if item.status %}
                    <span class="status-{{ item.status }}">[{{ item.status }}]</span>
                {% endif %}
                {% if item.note %}
                    <p style="margin-top: 5px; color: #6b7280;">{{ item.note }}</p>
                {% endif %}
            </div>
            {% endfor %}
        {% else %}
            <p style="color: #9ca3af;">해당 섹션에 대한 데이터가 없습니다.</p>
        {% endif %}
    </div>
    {% endfor %}
    
    {% if images %}
    <div class="section">
        <h2>진단 이미지</h2>
        <div class="image-grid">
            {% for image in images %}
            <div class="image-item">
                {% if image.get('file_key') %}
                    <p>{{ image.file_key }}</p>
                {% endif %}
                {% if image.get('section') %}
                    <p style="font-size: 10pt; color: #6b7280;">섹션: {{ image.section }}</p>
                {% endif %}
            </div>
            {% endfor %}
        </div>
    </div>
    {% endif %}
    
    {% if inspector_comment %}
    <div class="comment-box">
        <h3>종합 의견</h3>
        <p>{{ inspector_comment }}</p>
    </div>
    {% endif %}
    
    {% if repair_cost_est and repair_cost_est > 0 %}
    <div class="section">
        <h2>예상 수리비</h2>
        <p style="font-size: 16pt; font-weight: bold; color: #dc2626;">
            {{ "{:,}".format(repair_cost_est) }}원
        </p>
    </div>
    {% endif %}
    
    <div class="footer">
        <p>본 레포트는 NearCar에서 자동 생성되었습니다.</p>
        <p>문의: support@nearcar.com</p>
    </div>
</body>
</html>"""
    
    with open(template_path, "w", encoding="utf-8") as f:
        f.write(template_content)
    
    logger.info(f"기본 PDF 템플릿 생성 완료: {template_path}")

