"""
채널별 알림 발송 서비스
알리고 알림톡/SMS, AWS SES 연동
참고: https://smartsms.aligo.in/smsapi.html
"""
import requests
import boto3
from botocore.exceptions import ClientError
from typing import Dict, Any, Optional
from loguru import logger

from app.core.config import settings


class ChannelService:
    """채널별 알림 발송 서비스"""
    
    @staticmethod
    async def send_alimtalk(
        phone_number: str,
        template_code: str,
        content: str,
        variables: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        알리고 알림톡 발송
        
        Args:
            phone_number: 수신자 전화번호 (하이픈 제거, 예: 01012345678)
            template_code: 알리고 알림톡 템플릿 코드
            content: 메시지 내용 (Jinja2 템플릿에서 렌더링된 결과)
            variables: 템플릿 변수 (선택적, destination 치환용)
        
        Returns:
            발송 결과
        """
        if not settings.ALIGO_API_KEY or not settings.ALIGO_USER_ID:
            logger.warning("알리고 API 키 또는 사용자 ID가 설정되지 않았습니다.")
            raise ValueError("알리고 API 키 또는 사용자 ID가 설정되지 않았습니다.")
        
        if not settings.ALIGO_SENDER:
            logger.warning("알리고 발신번호가 설정되지 않았습니다.")
            raise ValueError("알리고 발신번호가 설정되지 않았습니다.")
        
        # 알리고 알림톡 API 호출
        # 참고: https://smartsms.aligo.in/smsapi.html
        # 알림톡 API 엔드포인트 (실제 엔드포인트는 알리고 관리자 페이지에서 확인 필요)
        # 일반적으로 /talk/send/ 또는 /alimtalk/send/ 형태
        url = "https://apis.aligo.in/talk/send/"
        
        # 전화번호 하이픈 제거
        receiver = phone_number.replace("-", "")
        
        # destination 파라미터 생성 (치환용)
        destination = None
        if variables and "customer_name" in variables:
            destination = f"{receiver}|{variables['customer_name']}"
        
        payload = {
            "key": settings.ALIGO_API_KEY,
            "user_id": settings.ALIGO_USER_ID,
            "sender": settings.ALIGO_SENDER,
            "receiver": receiver,
            "msg": content,
            "template_code": template_code,
        }
        
        if destination:
            payload["destination"] = destination
        
        if settings.ALIGO_TEST_MODE:
            payload["testmode_yn"] = "Y"
        
        try:
            response = requests.post(url, data=payload)
            response.raise_for_status()
            
            result = response.json()
            
            # result_code가 0보다 작으면 실패
            if result.get("result_code", 0) < 0:
                error_msg = result.get("message", "알 수 없는 오류")
                logger.error(f"알리고 알림톡 발송 실패: {error_msg}")
                raise ValueError(f"알리고 알림톡 발송 실패: {error_msg}")
            
            logger.info(f"알리고 알림톡 발송 성공: {phone_number}, msg_id: {result.get('msg_id')}")
            return {
                "success": True,
                "channel": "alimtalk",
                "message_id": str(result.get("msg_id", "")),
                "success_cnt": result.get("success_cnt", 0),
                "error_cnt": result.get("error_cnt", 0),
                "msg_type": result.get("msg_type", "")
            }
        
        except requests.exceptions.RequestException as e:
            logger.error(f"알리고 알림톡 발송 실패: {e}")
            raise ValueError(f"알리고 알림톡 발송 실패: {str(e)}")
    
    @staticmethod
    async def send_sms(
        phone_number: str,
        content: str,
        title: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        알리고 SMS 발송
        
        Args:
            phone_number: 수신자 전화번호 (하이픈 제거, 예: 01012345678)
            content: 메시지 내용
            title: 메시지 제목 (LMS/MMS용, 선택적)
        
        Returns:
            발송 결과
        """
        if not settings.ALIGO_API_KEY or not settings.ALIGO_USER_ID:
            logger.warning("알리고 API 키 또는 사용자 ID가 설정되지 않았습니다.")
            raise ValueError("알리고 API 키 또는 사용자 ID가 설정되지 않았습니다.")
        
        if not settings.ALIGO_SENDER:
            logger.warning("알리고 발신번호가 설정되지 않았습니다.")
            raise ValueError("알리고 발신번호가 설정되지 않았습니다.")
        
        # 알리고 SMS API 호출
        # 참고: https://smartsms.aligo.in/smsapi.html
        url = "https://apis.aligo.in/send/"
        
        # 전화번호 하이픈 제거
        receiver = phone_number.replace("-", "")
        
        # 메시지 타입 결정 (90바이트 초과 시 LMS)
        msg_type = "SMS"
        if len(content.encode("euc-kr")) > 90:
            msg_type = "LMS"
        
        payload = {
            "key": settings.ALIGO_API_KEY,
            "user_id": settings.ALIGO_USER_ID,
            "sender": settings.ALIGO_SENDER,
            "receiver": receiver,
            "msg": content,
            "msg_type": msg_type,
        }
        
        if title and msg_type in ("LMS", "MMS"):
            payload["title"] = title
        
        if settings.ALIGO_TEST_MODE:
            payload["testmode_yn"] = "Y"
        
        try:
            response = requests.post(url, data=payload)
            response.raise_for_status()
            
            result = response.json()
            
            # result_code가 0보다 작으면 실패
            if result.get("result_code", 0) < 0:
                error_msg = result.get("message", "알 수 없는 오류")
                logger.error(f"알리고 SMS 발송 실패: {error_msg}")
                raise ValueError(f"알리고 SMS 발송 실패: {error_msg}")
            
            logger.info(f"알리고 SMS 발송 성공: {phone_number}, msg_id: {result.get('msg_id')}")
            return {
                "success": True,
                "channel": "sms",
                "message_id": str(result.get("msg_id", "")),
                "success_cnt": result.get("success_cnt", 0),
                "error_cnt": result.get("error_cnt", 0),
                "msg_type": result.get("msg_type", "")
            }
        
        except requests.exceptions.RequestException as e:
            logger.error(f"알리고 SMS 발송 실패: {e}")
            raise ValueError(f"알리고 SMS 발송 실패: {str(e)}")
    
    @staticmethod
    async def send_email(
        email: str,
        subject: str,
        content: str,
        content_html: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        AWS SES 이메일 발송
        
        Args:
            email: 수신자 이메일
            subject: 이메일 제목
            content: 이메일 본문 (텍스트)
            content_html: 이메일 본문 (HTML, 선택적)
        
        Returns:
            발송 결과
        """
        if not settings.AWS_ACCESS_KEY_ID or not settings.AWS_SECRET_ACCESS_KEY:
            logger.warning("AWS 자격 증명이 설정되지 않았습니다.")
            raise ValueError("AWS 자격 증명이 설정되지 않았습니다.")
        
        # AWS SES 클라이언트 생성
        ses_client = boto3.client(
            'ses',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_SES_REGION
        )
        
        # 이메일 발송
        try:
            destination = {
                'ToAddresses': [email]
            }
            
            message = {
                'Subject': {
                    'Data': subject,
                    'Charset': 'UTF-8'
                },
                'Body': {
                    'Text': {
                        'Data': content,
                        'Charset': 'UTF-8'
                    }
                }
            }
            
            if content_html:
                message['Body']['Html'] = {
                    'Data': content_html,
                    'Charset': 'UTF-8'
                }
            
            response = ses_client.send_email(
                Source='noreply@nearcar.com',  # 발신자 이메일 (실제 발신자로 변경 필요)
                Destination=destination,
                Message=message
            )
            
            logger.info(f"AWS SES 이메일 발송 성공: {email}")
            return {
                "success": True,
                "channel": "email",
                "message_id": response.get('MessageId', 'unknown')
            }
        
        except ClientError as e:
            logger.error(f"AWS SES 이메일 발송 실패: {e}")
            raise ValueError(f"AWS SES 이메일 발송 실패: {str(e)}")
    
    @staticmethod
    async def send_slack(
        message: str,
        webhook_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Slack 웹훅 메시지 발송
        
        Args:
            message: 메시지 내용
            webhook_url: Slack 웹훅 URL (선택적, 설정에서 가져올 수 있음)
        
        Returns:
            발송 결과
        """
        url = webhook_url or settings.SLACK_WEBHOOK_URL
        
        if not url:
            logger.warning("Slack 웹훅 URL이 설정되지 않았습니다.")
            raise ValueError("Slack 웹훅 URL이 설정되지 않았습니다.")
        
        payload = {
            "text": message
        }
        
        try:
            response = requests.post(url, json=payload)
            response.raise_for_status()
            
            logger.info("Slack 메시지 발송 성공")
            return {
                "success": True,
                "channel": "slack",
                "message_id": "webhook"
            }
        
        except requests.exceptions.RequestException as e:
            logger.error(f"Slack 메시지 발송 실패: {e}")
            raise ValueError(f"Slack 메시지 발송 실패: {str(e)}")

