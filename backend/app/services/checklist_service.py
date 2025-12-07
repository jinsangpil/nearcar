"""
체크리스트 서비스
"""
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.inspection_report import InspectionReport
from app.models.inspection import Inspection
from loguru import logger


class ChecklistService:
    """체크리스트 서비스"""
    
    # 체크리스트 템플릿 (하드코딩, 나중에 DB로 이동 가능)
    TEMPLATES = [
        {
            "section": "외관",
            "items": [
                {"id": "front_bumper", "name": "앞 범퍼", "type": "checkbox"},
                {"id": "rear_bumper", "name": "뒤 범퍼", "type": "checkbox"},
                {"id": "front_headlight", "name": "앞 헤드라이트", "type": "checkbox"},
                {"id": "rear_tailight", "name": "뒤 테일라이트", "type": "checkbox"},
                {"id": "windshield", "name": "앞 유리", "type": "checkbox"},
                {"id": "rear_windshield", "name": "뒤 유리", "type": "checkbox"},
                {"id": "side_mirrors", "name": "사이드 미러", "type": "checkbox"},
                {"id": "doors", "name": "도어", "type": "checkbox"},
                {"id": "tires", "name": "타이어", "type": "checkbox"},
                {"id": "wheels", "name": "휠", "type": "checkbox"}
            ]
        },
        {
            "section": "엔진룸",
            "items": [
                {"id": "engine_oil", "name": "엔진 오일", "type": "select", "options": ["normal", "leak", "low"]},
                {"id": "coolant", "name": "냉각수", "type": "select", "options": ["normal", "leak", "low"]},
                {"id": "brake_fluid", "name": "브레이크 오일", "type": "select", "options": ["normal", "leak", "low"]},
                {"id": "battery", "name": "배터리", "type": "select", "options": ["normal", "weak", "dead"]},
                {"id": "belts", "name": "벨트", "type": "checkbox"},
                {"id": "hoses", "name": "호스", "type": "checkbox"}
            ]
        },
        {
            "section": "하부",
            "items": [
                {"id": "underbody", "name": "하부", "type": "checkbox"},
                {"id": "exhaust", "name": "배기계", "type": "checkbox"},
                {"id": "suspension", "name": "서스펜션", "type": "checkbox"},
                {"id": "transmission", "name": "변속기", "type": "select", "options": ["normal", "leak", "abnormal"]}
            ]
        },
        {
            "section": "실내",
            "items": [
                {"id": "dashboard", "name": "대시보드", "type": "checkbox"},
                {"id": "seats", "name": "시트", "type": "checkbox"},
                {"id": "air_conditioning", "name": "에어컨", "type": "select", "options": ["normal", "weak", "broken"]},
                {"id": "audio", "name": "오디오", "type": "checkbox"},
                {"id": "interior_lights", "name": "실내등", "type": "checkbox"}
            ]
        },
        {
            "section": "전장품",
            "items": [
                {"id": "headlights", "name": "헤드라이트", "type": "checkbox"},
                {"id": "taillights", "name": "테일라이트", "type": "checkbox"},
                {"id": "turn_signals", "name": "방향지시등", "type": "checkbox"},
                {"id": "hazard_lights", "name": "비상등", "type": "checkbox"},
                {"id": "wipers", "name": "와이퍼", "type": "checkbox"}
            ]
        }
    ]
    
    @staticmethod
    def get_templates() -> List[Dict[str, Any]]:
        """
        체크리스트 템플릿 조회
        
        Returns:
            체크리스트 템플릿 목록
        """
        return ChecklistService.TEMPLATES
    
    @staticmethod
    async def save_checklist(
        db: AsyncSession,
        inspection_id: str,
        checklist_data: Dict[str, Any],
        images: Optional[List[Dict[str, Any]]] = None,
        inspector_comment: Optional[str] = None,
        repair_cost_est: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        체크리스트 저장
        
        Args:
            db: 데이터베이스 세션
            inspection_id: 진단 신청 ID
            checklist_data: 체크리스트 데이터
            images: 이미지 URL 리스트
            inspector_comment: 종합 의견
            repair_cost_est: 예상 수리비
        
        Returns:
            저장된 InspectionReport 정보
        """
        # Inspection 조회 및 권한 확인
        inspection_result = await db.execute(
            select(Inspection).where(Inspection.id == inspection_id)
        )
        inspection = inspection_result.scalar_one_or_none()
        
        if not inspection:
            raise ValueError("진단 신청을 찾을 수 없습니다")
        
        if inspection.status not in ["assigned", "in_progress"]:
            raise ValueError("체크리스트를 작성할 수 있는 상태가 아닙니다")
        
        # 기존 InspectionReport 확인
        report_result = await db.execute(
            select(InspectionReport).where(InspectionReport.inspection_id == inspection_id)
        )
        report = report_result.scalar_one_or_none()
        
        if report:
            # 업데이트
            report.checklist_data = checklist_data
            report.images = images or []
            report.inspector_comment = inspector_comment
            report.repair_cost_est = repair_cost_est
            report.status = "submitted"
        else:
            # 생성
            report = InspectionReport(
                inspection_id=inspection_id,
                checklist_data=checklist_data,
                images=images or [],
                inspector_comment=inspector_comment,
                repair_cost_est=repair_cost_est,
                status="submitted"
            )
            db.add(report)
        
        # Inspection 상태 업데이트
        inspection.status = "report_submitted"
        
        await db.commit()
        await db.refresh(report)
        
        # 레포트 제출 알림 트리거
        from app.services.notification_trigger_service import NotificationTriggerService
        
        NotificationTriggerService.trigger_report_submitted(
            inspection_id=inspection_id,
            user_id=str(inspection.user_id),
            report_data={
                "inspector_comment": inspector_comment,
                "repair_cost_est": repair_cost_est
            }
        )
        
        return {
            "report_id": str(report.id),
            "inspection_id": str(inspection_id),
            "status": report.status
        }
    
    @staticmethod
    async def get_checklist(
        db: AsyncSession,
        inspection_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        체크리스트 조회
        
        Args:
            db: 데이터베이스 세션
            inspection_id: 진단 신청 ID
        
        Returns:
            InspectionReport 정보
        """
        result = await db.execute(
            select(InspectionReport).where(InspectionReport.inspection_id == inspection_id)
        )
        report = result.scalar_one_or_none()
        
        if not report:
            return None
        
        return {
            "inspection_id": str(report.inspection_id),
            "checklist_data": report.checklist_data,
            "images": report.images,
            "inspector_comment": report.inspector_comment,
            "repair_cost_est": report.repair_cost_est,
            "status": report.status,
            "created_at": report.created_at.isoformat()
        }

