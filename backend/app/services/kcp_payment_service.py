"""
KCP 결제 서비스
NHN KCP 표준결제 서비스 연동
"""
import requests
import json
from typing import Dict, Any, Optional
from datetime import datetime
from loguru import logger
from app.core.config import settings


class KcpPaymentService:
    """KCP 결제 API 연동 서비스"""
    
    def __init__(self):
        """KCP 결제 서비스 초기화"""
        self.api_url = settings.kcp_api_url
        self.site_cd = settings.KCP_SITE_CD
        self.cert_info = settings.KCP_CERT_INFO
    
    def register_trade(
        self,
        order_id: str,
        amount: int,
        good_name: str,
        buyr_name: str,
        buyr_tel: str,
        buyr_email: Optional[str] = None,
        ret_url: Optional[str] = None,
        good_cd: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        KCP 거래등록 (결제 요청)
        
        Args:
            order_id: 주문 번호
            amount: 결제 금액
            good_name: 상품명
            buyr_name: 구매자명
            buyr_tel: 구매자 전화번호
            buyr_email: 구매자 이메일 (선택)
            ret_url: 결제 완료 후 리다이렉트 URL
            good_cd: 상품 코드 (선택)
        
        Returns:
            거래등록 응답 데이터 (approval_key, PayUrl 등)
        """
        # 거래등록 요청 파라미터
        payload = {
            "tran_cd": "00100000",  # 거래 코드 (표준결제)
            "site_cd": self.site_cd,
            "kcp_cert_info": self.cert_info,
            "ordr_no": order_id,
            "ordr_mony": str(amount),
            "good_name": good_name,
            "buyr_name": buyr_name,
            "buyr_tel": buyr_tel,
            "pay_type": "PACA",  # 신용카드 결제 (기본값)
        }
        
        # 선택 파라미터 추가
        if buyr_email:
            payload["buyr_email"] = buyr_email
        if ret_url:
            payload["Ret_URL"] = ret_url
        if good_cd:
            payload["good_cd"] = good_cd
        
        # enc_data, enc_info는 KCP 암호화 모듈을 통해 생성해야 함
        # 현재는 기본 구조만 구현 (실제 연동 시 KCP 암호화 모듈 필요)
        # TODO: KCP 암호화 모듈 연동 필요
        payload["enc_data"] = ""  # 암호화된 결제 정보
        payload["enc_info"] = ""  # 암호화 정보
        
        try:
            response = requests.post(
                self.api_url,
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "Accept-Charset": "UTF-8"
                },
                timeout=10
            )
            response.raise_for_status()
            result = response.json()
            
            # KCP 응답 검증
            if result.get("res_cd") != "0000":
                error_msg = result.get("res_msg", "거래등록 실패")
                logger.error(f"KCP 거래등록 실패: {error_msg}")
                raise ValueError(f"KCP 거래등록 실패: {error_msg}")
            
            return {
                "approval_key": result.get("approval_key", ""),
                "pay_url": result.get("PayUrl", ""),
                "order_id": order_id,
                "res_cd": result.get("res_cd", ""),
                "res_msg": result.get("res_msg", "")
            }
        except requests.exceptions.HTTPError as e:
            error_data = e.response.json() if e.response else {}
            error_code = error_data.get("res_cd", "UNKNOWN_ERROR")
            error_message = error_data.get("res_msg", str(e))
            logger.error(f"KCP 거래등록 HTTP 오류: {error_code} - {error_message}")
            raise ValueError(f"KCP 거래등록 실패: {error_message}")
        except requests.exceptions.RequestException as e:
            logger.error(f"KCP 거래등록 요청 실패: {str(e)}")
            raise ValueError(f"KCP 거래등록 요청 실패: {str(e)}")
    
    def verify_payment(
        self,
        order_id: str,
        tno: str,
        amount: int,
        res_cd: str
    ) -> Dict[str, Any]:
        """
        KCP 결제 결과 검증
        
        Args:
            order_id: 주문 번호
            tno: KCP 거래번호
            amount: 결제 금액
            res_cd: 결과 코드 (0000: 성공)
        
        Returns:
            검증 결과 데이터
        """
        # res_cd가 0000이면 성공
        if res_cd != "0000":
            error_msg = f"결제 실패: {res_cd}"
            logger.error(f"KCP 결제 실패: {error_msg}")
            raise ValueError(error_msg)
        
        # 금액 검증은 PaymentService에서 수행
        # 여기서는 기본 검증만 수행
        
        return {
            "order_id": order_id,
            "transaction_id": tno,
            "amount": amount,
            "status": "success" if res_cd == "0000" else "failed"
        }
    
    def verify_amount(self, server_amount: int, client_amount: int) -> bool:
        """
        금액 검증
        
        Args:
            server_amount: 서버에서 계산한 금액
            client_amount: 클라이언트에서 전달한 금액
        
        Returns:
            금액 일치 여부
        """
        return server_amount == client_amount
    
    def cancel_payment(
        self,
        transaction_id: str,
        order_id: str,
        cancel_amount: int,
        cancel_reason: str,
        retry_count: int = 0,
        max_retries: int = 3
    ) -> Dict[str, Any]:
        """
        KCP 결제 취소
        
        Args:
            transaction_id: KCP 거래번호 (tno)
            order_id: 주문 번호
            cancel_amount: 취소 금액
            cancel_reason: 취소 사유
            retry_count: 현재 재시도 횟수
            max_retries: 최대 재시도 횟수
        
        Returns:
            취소 응답 데이터
        """
        # 취소 요청 파라미터
        payload = {
            "tran_cd": "00200000",  # 거래 코드 (취소)
            "site_cd": self.site_cd,
            "kcp_cert_info": self.cert_info,
            "tno": transaction_id,  # 원거래번호
            "ordr_no": order_id,
            "modi_mony": str(cancel_amount),  # 취소 금액
            "modi_desc": cancel_reason[:100],  # 취소 사유 (최대 100자)
        }
        
        # enc_data, enc_info는 KCP 암호화 모듈을 통해 생성해야 함
        # TODO: KCP 암호화 모듈 연동 필요
        payload["enc_data"] = ""  # 암호화된 취소 정보
        payload["enc_info"] = ""  # 암호화 정보
        
        try:
            response = requests.post(
                self.api_url.replace("/payment", "/cancel"),  # 취소 API URL
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "Accept-Charset": "UTF-8"
                },
                timeout=10
            )
            response.raise_for_status()
            result = response.json()
            
            # KCP 응답 검증
            if result.get("res_cd") != "0000":
                error_msg = result.get("res_msg", "거래취소 실패")
                logger.error(f"KCP 거래취소 실패: {error_msg}")
                
                # 재시도 가능한 오류인지 확인
                if retry_count < max_retries and self._is_retryable_error(result.get("res_cd")):
                    logger.info(f"KCP 거래취소 재시도: {retry_count + 1}/{max_retries}")
                    import time
                    time.sleep(2 ** retry_count)  # 지수 백오프
                    return self.cancel_payment(
                        transaction_id=transaction_id,
                        order_id=order_id,
                        cancel_amount=cancel_amount,
                        cancel_reason=cancel_reason,
                        retry_count=retry_count + 1,
                        max_retries=max_retries
                    )
                
                raise ValueError(f"KCP 거래취소 실패: {error_msg}")
            
            return {
                "success": True,
                "transaction_id": transaction_id,
                "cancel_amount": cancel_amount,
                "res_cd": result.get("res_cd", ""),
                "res_msg": result.get("res_msg", ""),
                "canceled_at": datetime.now().isoformat()
            }
        except requests.exceptions.HTTPError as e:
            error_data = e.response.json() if e.response else {}
            error_code = error_data.get("res_cd", "UNKNOWN_ERROR")
            error_message = error_data.get("res_msg", str(e))
            logger.error(f"KCP 거래취소 HTTP 오류: {error_code} - {error_message}")
            
            # 재시도 가능한 오류인지 확인
            if retry_count < max_retries and self._is_retryable_error(error_code):
                logger.info(f"KCP 거래취소 재시도: {retry_count + 1}/{max_retries}")
                import time
                time.sleep(2 ** retry_count)  # 지수 백오프
                return self.cancel_payment(
                    transaction_id=transaction_id,
                    order_id=order_id,
                    cancel_amount=cancel_amount,
                    cancel_reason=cancel_reason,
                    retry_count=retry_count + 1,
                    max_retries=max_retries
                )
            
            raise ValueError(f"KCP 거래취소 실패: {error_message}")
        except requests.exceptions.RequestException as e:
            logger.error(f"KCP 거래취소 요청 실패: {str(e)}")
            
            # 네트워크 오류는 재시도 가능
            if retry_count < max_retries:
                logger.info(f"KCP 거래취소 재시도 (네트워크 오류): {retry_count + 1}/{max_retries}")
                import time
                time.sleep(2 ** retry_count)  # 지수 백오프
                return self.cancel_payment(
                    transaction_id=transaction_id,
                    order_id=order_id,
                    cancel_amount=cancel_amount,
                    cancel_reason=cancel_reason,
                    retry_count=retry_count + 1,
                    max_retries=max_retries
                )
            
            raise ValueError(f"KCP 거래취소 요청 실패: {str(e)}")
    
    def _is_retryable_error(self, error_code: str) -> bool:
        """
        재시도 가능한 오류인지 확인
        
        Args:
            error_code: KCP 오류 코드
        
        Returns:
            재시도 가능 여부
        """
        # 재시도 가능한 오류 코드 목록
        retryable_errors = [
            "0001",  # 일시적 오류
            "0002",  # 네트워크 오류
            "0003",  # 타임아웃
        ]
        return error_code in retryable_errors
    
    def sync_payment_status(
        self,
        transaction_id: str,
        order_id: str
    ) -> Dict[str, Any]:
        """
        KCP 결제 상태 동기화 (상태 불일치 감지)
        
        Args:
            transaction_id: KCP 거래번호
            order_id: 주문 번호
        
        Returns:
            동기화된 결제 상태 정보
        """
        # KCP 거래조회 API 호출
        # TODO: KCP 거래조회 API 구현 필요
        # 현재는 기본 구조만 구현
        
        payload = {
            "tran_cd": "00300000",  # 거래 코드 (조회)
            "site_cd": self.site_cd,
            "kcp_cert_info": self.cert_info,
            "tno": transaction_id,
            "ordr_no": order_id,
        }
        
        try:
            response = requests.post(
                self.api_url.replace("/payment", "/inquiry"),  # 조회 API URL
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "Accept-Charset": "UTF-8"
                },
                timeout=10
            )
            response.raise_for_status()
            result = response.json()
            
            return {
                "transaction_id": transaction_id,
                "order_id": order_id,
                "status": result.get("res_cd") == "0000" and "paid" or "failed",
                "amount": int(result.get("ordr_mony", 0)),
                "paid_at": result.get("appr_time"),
                "res_cd": result.get("res_cd", ""),
                "res_msg": result.get("res_msg", "")
            }
        except Exception as e:
            logger.error(f"KCP 결제 상태 동기화 실패: {str(e)}")
            raise ValueError(f"결제 상태 동기화 실패: {str(e)}")

