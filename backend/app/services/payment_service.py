"""
결제 비즈니스 로직 서비스
"""
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
import uuid

from app.models.payment import Payment
from app.models.inspection import Inspection
from app.services.pricing_service import PricingService
from app.services.toss_payment_service import TossPaymentService
from app.core.config import settings
from loguru import logger


class PaymentService:
    """결제 비즈니스 로직 서비스"""
    
    def __init__(self):
        """결제 서비스 초기화"""
        self.toss_service = TossPaymentService()
    
    async def request_payment(
        self,
        db: AsyncSession,
        inspection_id: str,
        amount: int,
        customer_info: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        결제 요청 처리
        
        Args:
            db: 데이터베이스 세션
            inspection_id: 진단 신청 ID
            amount: 클라이언트 요청 금액
            customer_info: 고객 정보
        
        Returns:
            결제 요청 응답 데이터
        """
        # 1. Inspection 조회 (UUID 변환)
        try:
            inspection_uuid = uuid.UUID(inspection_id)
        except ValueError:
            raise ValueError("유효하지 않은 진단 신청 ID 형식입니다")
        
        inspection_result = await db.execute(
            select(Inspection).where(Inspection.id == inspection_uuid)
        )
        inspection = inspection_result.scalar_one_or_none()
        
        if not inspection:
            raise ValueError("진단 신청을 찾을 수 없습니다")
        
        # 2. 이미 결제가 존재하는지 확인
        existing_payment_result = await db.execute(
            select(Payment).where(Payment.inspection_id == inspection_uuid)
        )
        existing_payment = existing_payment_result.scalar_one_or_none()
        
        if existing_payment and existing_payment.status == "paid":
            raise ValueError("이미 결제가 완료된 신청입니다")
        
        # 3. 서버에서 최종 금액 재계산 (위변조 방지)
        # Inspection에 이미 total_amount가 저장되어 있으므로 이를 사용
        server_amount = inspection.total_amount
        
        # 4. 금액 검증
        if not self.toss_service.verify_amount(server_amount, amount):
            raise ValueError(f"결제 금액이 일치하지 않습니다. 예상 금액: {server_amount}원")
        
        # 5. Payment 레코드 생성 또는 업데이트
        if existing_payment:
            payment = existing_payment
            payment.amount = amount
            payment.status = "pending"
        else:
            payment = Payment(
                inspection_id=inspection_uuid,  # UUID 객체 사용
                amount=amount,
                method="card",  # 기본값, 실제로는 클라이언트에서 선택
                pg_provider="toss",
                status="pending"
            )
            db.add(payment)
        
        await db.commit()
        await db.refresh(payment)
        
        # 6. 토스페이먼츠 결제 요청 생성
        order_id = f"inspection-{inspection_id}-{int(datetime.now().timestamp())}"
        
        try:
            toss_response = self.toss_service.create_payment(
                order_id=order_id,
                amount=amount,
                customer_name=customer_info.get("name", "고객"),
                customer_email=customer_info.get("email"),
                customer_phone=customer_info.get("phone"),
                success_url=f"{self.toss_service.client_key}/payments/success?orderId={order_id}",
                fail_url=f"{self.toss_service.client_key}/payments/fail?orderId={order_id}"
            )
            
            # Payment에 order_id 저장 (transaction_id 필드 활용)
            payment.transaction_id = order_id
            await db.commit()
            
            return {
                "order_id": order_id,
                "payment_key": toss_response.get("paymentKey"),
                "success_url": toss_response.get("successUrl"),
                "fail_url": toss_response.get("failUrl"),
                "amount": amount
            }
        except Exception as e:
            logger.error(f"결제 요청 생성 실패: {str(e)}")
            payment.status = "failed"
            await db.commit()
            raise
    
    async def confirm_payment(
        self,
        db: AsyncSession,
        payment_key: str,
        order_id: str,
        amount: int
    ) -> Dict[str, Any]:
        """
        결제 승인 처리
        
        Args:
            db: 데이터베이스 세션
            payment_key: 결제 키
            order_id: 주문 ID
            amount: 결제 금액
        
        Returns:
            결제 승인 응답 데이터
        """
        # 1. Payment 조회 (order_id로)
        payment_result = await db.execute(
            select(Payment).where(Payment.transaction_id == order_id)
        )
        payment = payment_result.scalar_one_or_none()
        
        if not payment:
            raise ValueError("결제 정보를 찾을 수 없습니다")
        
        if payment.status == "paid":
            raise ValueError("이미 결제가 완료되었습니다")
        
        # 2. Inspection 조회 (UUID 변환)
        inspection_id = payment.inspection_id
        # SQLite에서 UUID가 문자열로 저장될 수 있으므로 변환
        if inspection_id is None:
            raise ValueError("결제 정보에 진단 신청 ID가 없습니다")
        if isinstance(inspection_id, str):
            try:
                inspection_id = uuid.UUID(inspection_id)
            except ValueError:
                raise ValueError(f"유효하지 않은 진단 신청 ID 형식입니다: {inspection_id}")
        elif not isinstance(inspection_id, uuid.UUID):
            try:
                inspection_id = uuid.UUID(str(inspection_id))
            except ValueError:
                raise ValueError(f"유효하지 않은 진단 신청 ID 형식입니다: {inspection_id}")
        
        inspection_result = await db.execute(
            select(Inspection).where(Inspection.id == inspection_id)
        )
        inspection = inspection_result.scalar_one_or_none()
        
        if not inspection:
            raise ValueError("진단 신청을 찾을 수 없습니다")
        
        # 3. 금액 검증
        if payment.amount != amount:
            raise ValueError(f"결제 금액이 일치하지 않습니다. 예상 금액: {payment.amount}원")
        
        # 4. 토스페이먼츠 승인 API 호출
        try:
            toss_response = self.toss_service.confirm_payment(
                payment_key=payment_key,
                order_id=order_id,
                amount=amount
            )
            
            # 5. Payment 레코드 업데이트
            payment.status = "paid"
            payment.transaction_id = toss_response.get("transactionKey") or payment_key
            payment.paid_at = datetime.now()
            payment.method = toss_response.get("method", "card")
            
            # 6. Inspection 상태 업데이트 (결제 완료 -> requested)
            inspection.status = "requested"
            
            await db.commit()
            await db.refresh(payment)
            
            # 7. 결제 완료 알림 트리거
            from app.services.notification_trigger_service import NotificationTriggerService
            from app.services.inspection_service import InspectionService
            
            # Inspection 상세 정보 조회
            inspection_detail = await InspectionService.get_inspection_detail(
                db=db,
                inspection_id=str(inspection.id),
                user_id=str(inspection.user_id)
            )
            
            NotificationTriggerService.trigger_payment_completed(
                inspection_id=str(inspection.id),
                user_id=str(inspection.user_id),
                payment_data={
                    "amount": payment.amount,
                    "method": payment.method,
                    "transaction_id": payment.transaction_id
                }
            )
            
            # 신청 완료 알림도 발송
            NotificationTriggerService.trigger_inspection_created(
                inspection_id=str(inspection.id),
                user_id=str(inspection.user_id),
                inspection_data=inspection_detail
            )
            
            # 5. Inspection 상태는 'requested'로 유지 (결제 완료 후에도 신청 상태)
            # 필요시 별도 상태 필드 추가 고려
            
            return {
                "payment_id": str(payment.id),
                "transaction_id": payment.transaction_id,
                "status": payment.status,
                "amount": payment.amount,
                "paid_at": payment.paid_at
            }
        except Exception as e:
            logger.error(f"결제 승인 실패: {str(e)}")
            payment.status = "failed"
            await db.commit()
            raise
    
    async def get_payment(
        self,
        db: AsyncSession,
        payment_id: str
    ) -> Optional[Payment]:
        """
        결제 정보 조회
        
        Args:
            db: 데이터베이스 세션
            payment_id: 결제 ID
        
        Returns:
            Payment 객체
        """
        result = await db.execute(
            select(Payment).where(Payment.id == payment_id)
        )
        return result.scalar_one_or_none()
    
    async def cancel_payment(
        self,
        db: AsyncSession,
        payment_id: str,
        cancel_reason: str,
        cancel_amount: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        결제 취소 처리
        
        Args:
            db: 데이터베이스 세션
            payment_id: 결제 ID
            cancel_reason: 취소 사유
            cancel_amount: 취소 금액 (None이면 전체 취소)
        
        Returns:
            취소 응답 데이터
        """
        # 1. Payment 조회
        payment = await self.get_payment(db, payment_id)
        
        if not payment:
            raise ValueError("결제 정보를 찾을 수 없습니다")
        
        if payment.status != "paid":
            raise ValueError("결제 완료된 건만 취소할 수 있습니다")
        
        # 2. 취소 금액 확인
        if cancel_amount and cancel_amount > payment.amount:
            raise ValueError("취소 금액이 결제 금액을 초과할 수 없습니다")
        
        cancel_amount_final = cancel_amount or payment.amount
        
        # 3. 토스페이먼츠 취소 API 호출
        try:
            # payment_key는 transaction_id에 저장되어 있을 수 있음
            # 실제로는 별도 필드에 저장하는 것이 좋지만, 현재 구조에서는 transaction_id 사용
            payment_key = payment.transaction_id
            
            self.toss_service.cancel_payment(
                payment_key=payment_key,
                cancel_reason=cancel_reason,
                cancel_amount=cancel_amount_final if cancel_amount else None
            )
            
            # 4. Payment 레코드 업데이트
            if cancel_amount_final == payment.amount:
                payment.status = "cancelled"
            else:
                payment.status = "refunded"
                # 부분 취소 시 금액 업데이트
                payment.amount = payment.amount - cancel_amount_final
            
            await db.commit()
            await db.refresh(payment)
            
            return {
                "payment_id": str(payment.id),
                "status": payment.status,
                "cancelled_amount": cancel_amount_final,
                "cancel_reason": cancel_reason
            }
        except Exception as e:
            logger.error(f"결제 취소 실패: {str(e)}")
            raise

