"""
상태별 자동 알림 트리거 서비스
"""
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.tasks.notification_tasks import send_notification_task


class NotificationTriggerService:
    """상태별 자동 알림 트리거 서비스"""
    
    @staticmethod
    def trigger_inspection_created(
        inspection_id: str,
        user_id: str,
        inspection_data: Dict[str, Any]
    ):
        """
        신청 완료 알림 트리거
        
        Args:
            inspection_id: 진단 신청 ID
            user_id: 고객 사용자 ID
            inspection_data: 진단 신청 데이터
        """
        try:
            logger.info(f"신청 완료 알림 트리거: inspection_id={inspection_id}, user_id={user_id}")
            
            # Celery Task로 비동기 발송
            send_notification_task.delay(
                user_id=user_id,
                channel="alimtalk",  # 기본 채널
                template_name="inspection_created",
                data={
                    "inspection_id": inspection_id,
                    "customer_name": inspection_data.get("customer_name", ""),
                    "vehicle_info": inspection_data.get("vehicle_info", ""),
                    "schedule_date": inspection_data.get("schedule_date", ""),
                    "total_amount": inspection_data.get("total_amount", 0)
                }
            )
            
        except Exception as e:
            logger.error(f"신청 완료 알림 트리거 실패: {e}")
    
    @staticmethod
    def trigger_inspection_assigned(
        inspection_id: str,
        user_id: str,
        inspector_id: str,
        inspection_data: Dict[str, Any]
    ):
        """
        기사 배정 알림 트리거
        
        Args:
            inspection_id: 진단 신청 ID
            user_id: 고객 사용자 ID
            inspector_id: 배정된 기사 ID
            inspection_data: 진단 신청 데이터
        """
        try:
            logger.info(f"기사 배정 알림 트리거: inspection_id={inspection_id}, user_id={user_id}, inspector_id={inspector_id}")
            
            # 고객에게 알림
            send_notification_task.delay(
                user_id=user_id,
                channel="alimtalk",
                template_name="inspection_assigned",
                data={
                    "inspection_id": inspection_id,
                    "customer_name": inspection_data.get("customer_name", ""),
                    "inspector_name": inspection_data.get("inspector_name", ""),
                    "inspector_phone": inspection_data.get("inspector_phone", ""),
                    "schedule_date": inspection_data.get("schedule_date", ""),
                    "schedule_time": inspection_data.get("schedule_time", "")
                }
            )
            
            # 기사에게도 알림 (선택적)
            if inspector_id:
                send_notification_task.delay(
                    user_id=inspector_id,
                    channel="sms",  # 기사는 SMS로
                    template_name="assignment_notification",
                    data={
                        "inspection_id": inspection_id,
                        "customer_name": inspection_data.get("customer_name", ""),
                        "vehicle_info": inspection_data.get("vehicle_info", ""),
                        "location": inspection_data.get("location_address", ""),
                        "schedule_date": inspection_data.get("schedule_date", ""),
                        "schedule_time": inspection_data.get("schedule_time", "")
                    }
                )
            
        except Exception as e:
            logger.error(f"기사 배정 알림 트리거 실패: {e}")
    
    @staticmethod
    def trigger_report_submitted(
        inspection_id: str,
        user_id: str,
        report_data: Dict[str, Any]
    ):
        """
        레포트 제출 알림 트리거
        
        Args:
            inspection_id: 진단 신청 ID
            user_id: 고객 사용자 ID
            report_data: 레포트 데이터
        """
        try:
            logger.info(f"레포트 제출 알림 트리거: inspection_id={inspection_id}, user_id={user_id}")
            
            # 운영자에게 알림 (Slack)
            send_notification_task.delay(
                user_id="admin",  # 운영자 알림은 특별 처리 필요
                channel="slack",
                template_name="report_submitted_admin",
                data={
                    "inspection_id": inspection_id,
                    "customer_name": report_data.get("customer_name", ""),
                    "vehicle_info": report_data.get("vehicle_info", ""),
                    "inspector_comment": report_data.get("inspector_comment", "")
                }
            )
            
        except Exception as e:
            logger.error(f"레포트 제출 알림 트리거 실패: {e}")
    
    @staticmethod
    def trigger_report_sent(
        inspection_id: str,
        user_id: str,
        report_data: Dict[str, Any]
    ):
        """
        레포트 발송 완료 알림 트리거
        
        Args:
            inspection_id: 진단 신청 ID
            user_id: 고객 사용자 ID
            report_data: 레포트 데이터 (PDF URL 포함)
        """
        try:
            logger.info(f"레포트 발송 완료 알림 트리거: inspection_id={inspection_id}, user_id={user_id}")
            
            # 고객에게 레포트 링크 알림
            send_notification_task.delay(
                user_id=user_id,
                channel="alimtalk",
                template_name="report_sent",
                data={
                    "inspection_id": inspection_id,
                    "customer_name": report_data.get("customer_name", ""),
                    "pdf_url": report_data.get("pdf_url", ""),
                    "web_view_url": report_data.get("web_view_url", "")
                }
            )
            
        except Exception as e:
            logger.error(f"레포트 발송 완료 알림 트리거 실패: {e}")
    
    @staticmethod
    def trigger_payment_completed(
        inspection_id: str,
        user_id: str,
        payment_data: Dict[str, Any]
    ):
        """
        결제 완료 알림 트리거
        
        Args:
            inspection_id: 진단 신청 ID
            user_id: 고객 사용자 ID
            payment_data: 결제 데이터
        """
        try:
            logger.info(f"결제 완료 알림 트리거: inspection_id={inspection_id}, user_id={user_id}")
            
            # 결제 완료 알림
            send_notification_task.delay(
                user_id=user_id,
                channel="alimtalk",
                template_name="payment_completed",
                data={
                    "inspection_id": inspection_id,
                    "amount": payment_data.get("amount", 0),
                    "method": payment_data.get("method", ""),
                    "transaction_id": payment_data.get("transaction_id", "")
                }
            )
            
        except Exception as e:
            logger.error(f"결제 완료 알림 트리거 실패: {e}")
    
    @staticmethod
    async def trigger_report_approved(
        db: AsyncSession,
        inspection_id: str,
        user_id: str
    ):
        """
        레포트 승인 알림 트리거
        
        Args:
            db: 데이터베이스 세션
            inspection_id: 진단 신청 ID
            user_id: 고객 사용자 ID
        """
        try:
            logger.info(f"레포트 승인 알림 트리거: inspection_id={inspection_id}, user_id={user_id}")
            
            # 고객에게 레포트 발송 알림
            from app.services.inspection_service import InspectionService
            inspection_detail = await InspectionService.get_inspection_detail(
                db=db,
                inspection_id=inspection_id,
                user_id=user_id
            )
            
            send_notification_task.delay(
                user_id=user_id,
                channel="alimtalk",
                template_name="report_approved",
                data={
                    "inspection_id": inspection_id,
                    "customer_name": inspection_detail.get("customer_name", ""),
                    "vehicle_info": inspection_detail.get("vehicle_info", ""),
                    "pdf_url": inspection_detail.get("report_summary", {}).get("pdf_url", "")
                }
            )
            
        except Exception as e:
            logger.error(f"레포트 승인 알림 트리거 실패: {e}")
    
    @staticmethod
    async def trigger_report_rejected(
        db: AsyncSession,
        inspection_id: str,
        inspector_id: str,
        feedback: str = ""
    ):
        """
        레포트 반려 알림 트리거
        
        Args:
            db: 데이터베이스 세션
            inspection_id: 진단 신청 ID
            inspector_id: 기사 ID
            feedback: 반려 사유/피드백
        """
        try:
            logger.info(f"레포트 반려 알림 트리거: inspection_id={inspection_id}, inspector_id={inspector_id}")
            
            # 기사에게 수정 요청 알림
            send_notification_task.delay(
                user_id=inspector_id,
                channel="sms",
                template_name="report_rejected",
                data={
                    "inspection_id": inspection_id,
                    "feedback": feedback
                }
            )
            
        except Exception as e:
            logger.error(f"레포트 반려 알림 트리거 실패: {e}")

