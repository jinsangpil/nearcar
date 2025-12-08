import pytest
from unittest.mock import patch, MagicMock

from app.services.notification_trigger_service import NotificationTriggerService


@pytest.mark.unit
class TestNotificationTriggerService:
    """상태별 자동 알림 트리거 서비스 테스트"""

    def test_trigger_inspection_created(self):
        """신청 완료 알림 트리거 테스트"""
        with patch('app.services.notification_trigger_service.send_notification_task') as mock_task:
            mock_task.delay = MagicMock()

            NotificationTriggerService.trigger_inspection_created(
                inspection_id="test_inspection_id",
                user_id="test_user_id",
                inspection_data={
                    "customer_name": "홍길동",
                    "vehicle_info": "현대 아반떼",
                    "schedule_date": "2024-01-01",
                    "total_amount": 50000
                }
            )

            mock_task.delay.assert_called_once()
            call_args = mock_task.delay.call_args
            assert call_args[1]["user_id"] == "test_user_id"
            assert call_args[1]["channel"] == "alimtalk"
            assert call_args[1]["template_name"] == "inspection_created"
            assert "inspection_id" in call_args[1]["data"]

    def test_trigger_inspection_assigned(self):
        """기사 배정 알림 트리거 테스트"""
        with patch('app.services.notification_trigger_service.send_notification_task') as mock_task:
            mock_task.delay = MagicMock()

            NotificationTriggerService.trigger_inspection_assigned(
                inspection_id="test_inspection_id",
                user_id="test_user_id",
                inspector_id="test_inspector_id",
                inspection_data={
                    "customer_name": "홍길동",
                    "inspector_name": "기사1",
                    "inspector_phone": "01012345678",
                    "schedule_date": "2024-01-01",
                    "schedule_time": "14:00"
                }
            )

            # 고객 알림과 기사 알림 두 번 호출되어야 함
            assert mock_task.delay.call_count == 2

            # 첫 번째 호출: 고객 알림톡
            first_call = mock_task.delay.call_args_list[0]
            assert first_call[1]["user_id"] == "test_user_id"
            assert first_call[1]["channel"] == "alimtalk"
            assert first_call[1]["template_name"] == "inspection_assigned"

            # 두 번째 호출: 기사 SMS
            second_call = mock_task.delay.call_args_list[1]
            assert second_call[1]["user_id"] == "test_inspector_id"
            assert second_call[1]["channel"] == "sms"
            assert second_call[1]["template_name"] == "assignment_notification"

    def test_trigger_report_submitted(self):
        """레포트 제출 알림 트리거 테스트"""
        with patch('app.services.notification_trigger_service.send_notification_task') as mock_task:
            mock_task.delay = MagicMock()

            NotificationTriggerService.trigger_report_submitted(
                inspection_id="test_inspection_id",
                user_id="test_user_id",
                report_data={
                    "customer_name": "홍길동",
                    "vehicle_info": "현대 아반떼",
                    "inspector_comment": "전반적으로 양호"
                }
            )

            mock_task.delay.assert_called_once()
            call_args = mock_task.delay.call_args
            assert call_args[1]["user_id"] == "admin"
            assert call_args[1]["channel"] == "slack"
            assert call_args[1]["template_name"] == "report_submitted_admin"

    def test_trigger_report_sent(self):
        """레포트 발송 완료 알림 트리거 테스트"""
        with patch('app.services.notification_trigger_service.send_notification_task') as mock_task:
            mock_task.delay = MagicMock()

            NotificationTriggerService.trigger_report_sent(
                inspection_id="test_inspection_id",
                user_id="test_user_id",
                report_data={
                    "customer_name": "홍길동",
                    "pdf_url": "https://s3.example.com/report.pdf",
                    "web_view_url": "https://example.com/report/view/123"
                }
            )

            mock_task.delay.assert_called_once()
            call_args = mock_task.delay.call_args
            assert call_args[1]["user_id"] == "test_user_id"
            assert call_args[1]["channel"] == "alimtalk"
            assert call_args[1]["template_name"] == "report_sent"
            assert "pdf_url" in call_args[1]["data"]

    def test_trigger_payment_completed(self):
        """결제 완료 알림 트리거 테스트"""
        with patch('app.services.notification_trigger_service.send_notification_task') as mock_task:
            mock_task.delay = MagicMock()

            NotificationTriggerService.trigger_payment_completed(
                inspection_id="test_inspection_id",
                user_id="test_user_id",
                payment_data={
                    "amount": 50000,
                    "method": "카드",
                    "transaction_id": "test_transaction_123"
                }
            )

            mock_task.delay.assert_called_once()
            call_args = mock_task.delay.call_args
            assert call_args[1]["user_id"] == "test_user_id"
            assert call_args[1]["channel"] == "alimtalk"
            assert call_args[1]["template_name"] == "payment_completed"
            assert call_args[1]["data"]["amount"] == 50000

    def test_trigger_inspection_assigned_no_inspector_id(self):
        """기사 배정 알림 트리거 (inspector_id 없음) 테스트"""
        with patch('app.services.notification_trigger_service.send_notification_task') as mock_task:
            mock_task.delay = MagicMock()

            NotificationTriggerService.trigger_inspection_assigned(
                inspection_id="test_inspection_id",
                user_id="test_user_id",
                inspector_id=None,  # inspector_id 없음
                inspection_data={}
            )

            # 고객 알림만 호출되어야 함 (기사 알림은 호출되지 않음)
            assert mock_task.delay.call_count == 1
            call_args = mock_task.delay.call_args
            assert call_args[1]["user_id"] == "test_user_id"

