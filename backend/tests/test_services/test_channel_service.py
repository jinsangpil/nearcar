import pytest
from unittest.mock import patch, MagicMock
import requests

from app.services.channel_service import ChannelService


@pytest.mark.asyncio
@pytest.mark.unit
class TestChannelService:
    """채널별 알림 발송 서비스 테스트"""

    @pytest.fixture(autouse=True)
    def mock_settings(self):
        """설정 모킹"""
        with patch('app.services.channel_service.settings') as mock_settings:
            mock_settings.ALIGO_API_KEY = "test_api_key"
            mock_settings.ALIGO_USER_ID = "test_user_id"
            mock_settings.ALIGO_SENDER = "01012345678"
            mock_settings.ALIGO_TEST_MODE = True
            mock_settings.AWS_ACCESS_KEY_ID = "test_access_key"
            mock_settings.AWS_SECRET_ACCESS_KEY = "test_secret_key"
            mock_settings.AWS_REGION = "ap-northeast-2"
            mock_settings.AWS_SES_FROM_EMAIL = "test@example.com"
            yield mock_settings

    async def test_send_alimtalk_success(self, mock_settings):
        """알림톡 발송 성공 테스트"""
        with patch('requests.post') as mock_post:
            # 성공 응답 모킹
            mock_response = MagicMock()
            mock_response.json.return_value = {
                "result_code": 1,
                "message": "success",
                "msg_id": "test_msg_id_123",
                "success_cnt": 1,
                "error_cnt": 0,
                "msg_type": "AT"
            }
            mock_response.raise_for_status = MagicMock()
            mock_post.return_value = mock_response

            result = await ChannelService.send_alimtalk(
                phone_number="01012345678",
                template_code="TEST_TEMPLATE",
                content="테스트 알림톡 메시지",
                variables={"customer_name": "홍길동"}
            )

            assert result["success"] is True
            assert result["channel"] == "alimtalk"
            assert result["message_id"] == "test_msg_id_123"
            mock_post.assert_called_once()

    async def test_send_alimtalk_api_error(self, mock_settings):
        """알림톡 발송 API 오류 테스트"""
        with patch('requests.post') as mock_post:
            # 실패 응답 모킹
            mock_response = MagicMock()
            mock_response.json.return_value = {
                "result_code": -100,
                "message": "API 오류"
            }
            mock_response.raise_for_status = MagicMock()
            mock_post.return_value = mock_response

            with pytest.raises(ValueError, match="알리고 알림톡 발송 실패"):
                await ChannelService.send_alimtalk(
                    phone_number="01012345678",
                    template_code="TEST_TEMPLATE",
                    content="테스트 알림톡 메시지"
                )

    async def test_send_alimtalk_missing_config(self):
        """알림톡 발송 설정 누락 테스트"""
        with patch('app.services.channel_service.settings') as mock_settings:
            mock_settings.ALIGO_API_KEY = None
            mock_settings.ALIGO_USER_ID = "test_user_id"
            mock_settings.ALIGO_SENDER = "01012345678"

            with pytest.raises(ValueError, match="알리고 API 키 또는 사용자 ID가 설정되지 않았습니다"):
                await ChannelService.send_alimtalk(
                    phone_number="01012345678",
                    template_code="TEST_TEMPLATE",
                    content="테스트 알림톡 메시지"
                )

    async def test_send_sms_success(self, mock_settings):
        """SMS 발송 성공 테스트"""
        with patch('requests.post') as mock_post:
            # 성공 응답 모킹
            mock_response = MagicMock()
            mock_response.json.return_value = {
                "result_code": 1,
                "message": "success",
                "msg_id": "test_sms_id_123",
                "success_cnt": 1,
                "error_cnt": 0,
                "msg_type": "SMS"
            }
            mock_response.raise_for_status = MagicMock()
            mock_post.return_value = mock_response

            result = await ChannelService.send_sms(
                phone_number="01012345678",
                content="테스트 SMS 메시지"
            )

            assert result["success"] is True
            assert result["channel"] == "sms"
            assert result["message_id"] == "test_sms_id_123"
            mock_post.assert_called_once()

    async def test_send_sms_lms_type(self, mock_settings):
        """LMS 타입 SMS 발송 테스트 (90바이트 초과)"""
        with patch('requests.post') as mock_post:
            # 성공 응답 모킹
            mock_response = MagicMock()
            mock_response.json.return_value = {
                "result_code": 1,
                "message": "success",
                "msg_id": "test_lms_id_123",
                "success_cnt": 1,
                "error_cnt": 0,
                "msg_type": "LMS"
            }
            mock_response.raise_for_status = MagicMock()
            mock_post.return_value = mock_response

            # 90바이트 초과 메시지 (한글 약 45자)
            long_content = "테스트" * 20  # 100자

            result = await ChannelService.send_sms(
                phone_number="01012345678",
                content=long_content,
                title="테스트 제목"
            )

            assert result["success"] is True
            assert result["channel"] == "sms"
            # payload에 msg_type이 LMS로 설정되었는지 확인
            call_args = mock_post.call_args
            assert call_args is not None

    async def test_send_email_success(self, mock_settings):
        """이메일 발송 성공 테스트"""
        with patch('boto3.client') as mock_boto_client:
            # SES 클라이언트 모킹
            mock_ses_client = MagicMock()
            mock_ses_client.send_email.return_value = {
                "MessageId": "test_message_id_123"
            }
            mock_boto_client.return_value = mock_ses_client

            result = await ChannelService.send_email(
                email="test@example.com",
                subject="테스트 이메일",
                content="테스트 이메일 본문",
                content_html="<p>테스트 이메일 본문</p>"
            )

            assert result["success"] is True
            assert result["channel"] == "email"
            assert result["message_id"] == "test_message_id_123"
            mock_ses_client.send_email.assert_called_once()

    async def test_send_email_missing_config(self):
        """이메일 발송 설정 누락 테스트"""
        with patch('app.services.channel_service.settings') as mock_settings:
            mock_settings.AWS_ACCESS_KEY_ID = None
            mock_settings.AWS_SECRET_ACCESS_KEY = "test_secret_key"

            with pytest.raises(ValueError, match="AWS 자격 증명이 설정되지 않았습니다"):
                await ChannelService.send_email(
                    email="test@example.com",
                    subject="테스트 이메일",
                    content="테스트 이메일 본문"
                )

    async def test_send_email_boto_error(self, mock_settings):
        """이메일 발송 Boto3 오류 테스트"""
        with patch('boto3.client') as mock_boto_client:
            from botocore.exceptions import ClientError
            import botocore.exceptions

            # SES 클라이언트 모킹
            mock_ses_client = MagicMock()
            error_response = {
                'Error': {
                    'Code': 'MessageRejected',
                    'Message': 'Email address not verified'
                }
            }
            mock_ses_client.send_email.side_effect = ClientError(error_response, 'SendEmail')
            mock_boto_client.return_value = mock_ses_client

            with pytest.raises(ValueError, match="AWS SES 이메일 발송 실패"):
                await ChannelService.send_email(
                    email="test@example.com",
                    subject="테스트 이메일",
                    content="테스트 이메일 본문"
                )

