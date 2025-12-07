"""
토스페이먼츠 API 연동 서비스
"""
import requests
import base64
from typing import Dict, Any, Optional
from datetime import datetime

from app.core.config import settings
from loguru import logger


class TossPaymentService:
    """토스페이먼츠 API 연동 서비스"""
    
    def __init__(self):
        """토스페이먼츠 서비스 초기화"""
        self.api_url = settings.toss_api_url
        self.secret_key = settings.TOSS_SECRET_KEY
        self.client_key = settings.TOSS_CLIENT_KEY
        
        # Basic Auth 헤더 생성
        credentials = f"{self.secret_key}:"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()
        self.headers = {
            "Authorization": f"Basic {encoded_credentials}",
            "Content-Type": "application/json"
        }
    
    def create_payment(
        self,
        order_id: str,
        amount: int,
        customer_name: str,
        customer_email: Optional[str] = None,
        customer_phone: Optional[str] = None,
        success_url: Optional[str] = None,
        fail_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        결제 요청 생성
        
        Args:
            order_id: 주문 ID
            amount: 결제 금액
            customer_name: 고객 이름
            customer_email: 고객 이메일 (선택)
            customer_phone: 고객 전화번호 (선택)
            success_url: 성공 리다이렉트 URL
            fail_url: 실패 리다이렉트 URL
        
        Returns:
            결제 요청 응답 데이터
        """
        if not success_url:
            success_url = f"{settings.FRONTEND_URL}/payments/success?orderId={order_id}"
        if not fail_url:
            fail_url = f"{settings.FRONTEND_URL}/payments/fail?orderId={order_id}"
        
        payload = {
            "amount": amount,
            "orderId": order_id,
            "orderName": f"중고차 진단 서비스 - {order_id[:8]}",
            "customerName": customer_name,
            "successUrl": success_url,
            "failUrl": fail_url
        }
        
        if customer_email:
            payload["customerEmail"] = customer_email
        if customer_phone:
            payload["customerPhone"] = customer_phone
        
        try:
            response = requests.post(
                f"{self.api_url}/payments",
                json=payload,
                headers=self.headers,
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"토스페이먼츠 결제 요청 생성 실패: {str(e)}")
            raise ValueError(f"결제 요청 생성 실패: {str(e)}")
    
    def confirm_payment(
        self,
        payment_key: str,
        order_id: str,
        amount: int
    ) -> Dict[str, Any]:
        """
        결제 승인 처리
        
        Args:
            payment_key: 결제 키
            order_id: 주문 ID
            amount: 결제 금액
        
        Returns:
            결제 승인 응답 데이터
        """
        payload = {
            "paymentKey": payment_key,
            "orderId": order_id,
            "amount": amount
        }
        
        try:
            response = requests.post(
                f"{self.api_url}/payments/confirm",
                json=payload,
                headers=self.headers,
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            error_data = e.response.json() if e.response else {}
            error_code = error_data.get("code", "UNKNOWN_ERROR")
            error_message = error_data.get("message", str(e))
            logger.error(f"토스페이먼츠 결제 승인 실패: {error_code} - {error_message}")
            raise ValueError(f"결제 승인 실패: {error_message}")
        except requests.exceptions.RequestException as e:
            logger.error(f"토스페이먼츠 결제 승인 요청 실패: {str(e)}")
            raise ValueError(f"결제 승인 요청 실패: {str(e)}")
    
    def get_payment_status(
        self,
        payment_key: str
    ) -> Dict[str, Any]:
        """
        결제 상태 조회
        
        Args:
            payment_key: 결제 키
        
        Returns:
            결제 상태 정보
        """
        try:
            response = requests.get(
                f"{self.api_url}/payments/{payment_key}",
                headers=self.headers,
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"토스페이먼츠 결제 상태 조회 실패: {str(e)}")
            raise ValueError(f"결제 상태 조회 실패: {str(e)}")
    
    def cancel_payment(
        self,
        payment_key: str,
        cancel_reason: str,
        cancel_amount: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        결제 취소 (전체/부분 취소)
        
        Args:
            payment_key: 결제 키
            cancel_reason: 취소 사유
            cancel_amount: 취소 금액 (None이면 전체 취소)
        
        Returns:
            취소 응답 데이터
        """
        payload = {
            "cancelReason": cancel_reason
        }
        
        if cancel_amount:
            payload["cancelAmount"] = cancel_amount
        
        try:
            response = requests.post(
                f"{self.api_url}/payments/{payment_key}/cancel",
                json=payload,
                headers=self.headers,
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            error_data = e.response.json() if e.response else {}
            error_code = error_data.get("code", "UNKNOWN_ERROR")
            error_message = error_data.get("message", str(e))
            logger.error(f"토스페이먼츠 결제 취소 실패: {error_code} - {error_message}")
            raise ValueError(f"결제 취소 실패: {error_message}")
        except requests.exceptions.RequestException as e:
            logger.error(f"토스페이먼츠 결제 취소 요청 실패: {str(e)}")
            raise ValueError(f"결제 취소 요청 실패: {str(e)}")
    
    def verify_amount(
        self,
        expected_amount: int,
        actual_amount: int
    ) -> bool:
        """
        금액 검증 (위변조 방지)
        
        Args:
            expected_amount: 예상 금액 (서버 계산)
            actual_amount: 실제 금액 (클라이언트 요청)
        
        Returns:
            검증 성공 여부
        """
        return expected_amount == actual_amount

