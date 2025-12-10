"""
결제 비즈니스 로직 서비스
"""
from typing import Dict, Any, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from datetime import datetime, date, timedelta
import uuid

from app.models.payment import Payment
from app.models.inspection import Inspection
from app.services.pricing_service import PricingService
from app.services.kcp_payment_service import KcpPaymentService
from app.core.config import settings
from loguru import logger


class PaymentService:
    """결제 비즈니스 로직 서비스"""
    
    def __init__(self):
        """결제 서비스 초기화"""
        self.kcp_service = KcpPaymentService()
    
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
        
        # 4. 금액 검증 (강화된 검증 로직)
        if not self.kcp_service.verify_amount(server_amount, amount):
            logger.warning(
                f"결제 금액 불일치 감지: "
                f"inspection_id={inspection_id}, "
                f"server_amount={server_amount}원, "
                f"client_amount={amount}원"
            )
            raise ValueError(f"결제 금액이 일치하지 않습니다. 예상 금액: {server_amount}원")
        
        # 금액 범위 검증 (최소/최대 금액 체크)
        if amount < 1000:  # 최소 결제 금액 1,000원
            raise ValueError("결제 금액은 최소 1,000원 이상이어야 합니다")
        if amount > 10000000:  # 최대 결제 금액 10,000,000원
            raise ValueError("결제 금액은 최대 10,000,000원을 초과할 수 없습니다")
        
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
                pg_provider="kcp",
                status="pending"
            )
            db.add(payment)
        
        await db.commit()
        await db.refresh(payment)
        
        # 6. KCP 거래등록 (결제 요청)
        order_id = f"inspection-{inspection_id}-{int(datetime.now().timestamp())}"
        
        try:
            # 결제 완료 후 리다이렉트 URL 설정
            ret_url = f"{settings.FRONTEND_URL}/apply/payment/callback"
            
            kcp_response = self.kcp_service.register_trade(
                order_id=order_id,
                amount=amount,
                good_name=f"중고차 진단 서비스 - {inspection_id[:8]}",
                buyr_name=customer_info.get("name", "고객"),
                buyr_tel=customer_info.get("phone", ""),
                buyr_email=customer_info.get("email"),
                ret_url=ret_url,
                good_cd=f"INSPECTION_{inspection_id[:8]}"
            )
            
            # Payment에 order_id 저장 (transaction_id 필드 활용)
            payment.transaction_id = order_id
            await db.commit()
            
            return {
                "order_id": order_id,
                "approval_key": kcp_response.get("approval_key"),
                "pay_url": kcp_response.get("pay_url"),
                "amount": amount
            }
        except Exception as e:
            logger.error(f"KCP 거래등록 실패: {str(e)}")
            payment.status = "failed"
            await db.commit()
            # 결제 로그 기록 (실패)
            logger.info(
                f"결제 요청 실패 로그: "
                f"inspection_id={inspection_id}, "
                f"order_id={order_id}, "
                f"amount={amount}, "
                f"error={str(e)}"
            )
            raise
    
    async def confirm_payment(
        self,
        db: AsyncSession,
        order_id: str,
        tno: Optional[str] = None,
        res_cd: Optional[str] = None,
        res_msg: Optional[str] = None,
        amount: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        KCP 결제 확인 처리
        
        Args:
            db: 데이터베이스 세션
            order_id: 주문 ID
            tno: KCP 거래번호
            res_cd: 결과 코드 (0000: 성공)
            res_msg: 결과 메시지
            amount: 결제 금액 (검증용)
        
        Returns:
            결제 확인 응답 데이터
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
        
        # 3. KCP 결제 결과 검증
        try:
            # res_cd가 0000이 아니면 실패
            if res_cd and res_cd != "0000":
                error_msg = res_msg or f"결제 실패: {res_cd}"
                logger.error(f"KCP 결제 실패: {error_msg}")
                payment.status = "failed"
                await db.commit()
                raise ValueError(error_msg)
            
            # 금액 검증 (강화된 검증 로직)
            if amount:
                # 정확한 금액 일치 검증
        if payment.amount != amount:
                    logger.error(
                        f"결제 금액 불일치: "
                        f"payment_id={str(payment.id)}, "
                        f"order_id={order_id}, "
                        f"예상={payment.amount}원, "
                        f"실제={amount}원"
                    )
                    payment.status = "failed"
                    await db.commit()
            raise ValueError(f"결제 금액이 일치하지 않습니다. 예상 금액: {payment.amount}원")
        
                # 금액 범위 검증
                if amount < 1000 or amount > 10000000:
                    logger.error(
                        f"결제 금액 범위 초과: "
                        f"payment_id={str(payment.id)}, "
                        f"amount={amount}원"
                    )
                    payment.status = "failed"
                    await db.commit()
                    raise ValueError("결제 금액이 허용 범위를 벗어났습니다")
            
            # 4. Payment 레코드 업데이트
            payment.status = "paid"
            payment.transaction_id = tno or order_id  # KCP 거래번호 저장
            payment.paid_at = datetime.now()
            payment.method = "card"  # KCP 기본값 (실제로는 결제 수단에 따라 다를 수 있음)
            
            # 5. Inspection 상태 업데이트 (결제 완료 -> requested)
            inspection.status = "requested"
            
            await db.commit()
            await db.refresh(payment)
            
            # 6. 결제 완료 알림 트리거
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
            
            # 결제 완료 로그 기록
            logger.info(
                f"결제 완료 로그: "
                f"payment_id={str(payment.id)}, "
                f"inspection_id={str(inspection.id)}, "
                f"order_id={order_id}, "
                f"transaction_id={payment.transaction_id}, "
                f"amount={payment.amount}, "
                f"method={payment.method}"
            )
            
            return {
                "payment_id": str(payment.id),
                "transaction_id": payment.transaction_id,
                "status": payment.status,
                "amount": payment.amount,
                "paid_at": payment.paid_at
            }
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"결제 확인 실패: {str(e)}")
            payment.status = "failed"
            await db.commit()
            # 결제 실패 로그 기록
            logger.info(
                f"결제 확인 실패 로그: "
                f"order_id={order_id}, "
                f"error={str(e)}"
            )
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
        
        # 3. KCP 취소 API 호출 (재시도 로직 포함)
        transaction_id = payment.transaction_id
        order_id = payment.transaction_id or f"inspection-{str(payment.inspection_id)}"
        
        if not transaction_id:
            raise ValueError("거래번호가 없어 취소할 수 없습니다")
        
        try:
            # KCP 취소 API 호출 (자동 재시도 포함)
            kcp_result = self.kcp_service.cancel_payment(
                transaction_id=transaction_id,
                order_id=order_id,
                cancel_amount=cancel_amount_final,
                cancel_reason=cancel_reason,
                retry_count=0,
                max_retries=3
            )
            
            # 4. Payment 레코드 업데이트
            old_status = payment.status
            old_amount = payment.amount
            
            if cancel_amount_final == payment.amount:
                payment.status = "cancelled"
            else:
                payment.status = "refunded"
                # 부분 취소 시 금액 업데이트
                payment.amount = payment.amount - cancel_amount_final
            
            await db.commit()
            await db.refresh(payment)
            
            # 5. Inspection 상태 자동 업데이트
            inspection_result = await db.execute(
                select(Inspection).where(Inspection.id == payment.inspection_id)
            )
            inspection = inspection_result.scalar_one_or_none()
            
            if inspection:
                inspection.status = "cancelled"
                await db.commit()
                logger.info(
                    f"Inspection 상태 자동 업데이트: "
                    f"inspection_id={str(inspection.id)}, "
                    f"status=cancelled (결제 취소)"
                )
            
            # 6. 취소 이력 로그 기록
            logger.info(
                f"결제 취소 완료: "
                f"payment_id={str(payment.id)}, "
                f"inspection_id={str(payment.inspection_id)}, "
                f"transaction_id={transaction_id}, "
                f"old_status={old_status}, "
                f"new_status={payment.status}, "
                f"old_amount={old_amount}원, "
                f"cancel_amount={cancel_amount_final}원, "
                f"cancel_reason={cancel_reason}"
            )
            
            # 7. 취소 알림 트리거
            from app.services.notification_trigger_service import NotificationTriggerService
            if inspection:
                NotificationTriggerService.trigger_payment_cancelled(
                    inspection_id=str(inspection.id),
                    user_id=str(inspection.user_id),
                    payment_data={
                        "amount": cancel_amount_final,
                        "cancel_reason": cancel_reason
                    }
                )
            
            return {
                "payment_id": str(payment.id),
                "status": payment.status,
                "cancelled_amount": cancel_amount_final,
                "cancel_reason": cancel_reason,
                "kcp_result": kcp_result
            }
        except Exception as e:
            logger.error(
                f"결제 취소 실패: "
                f"payment_id={str(payment.id)}, "
                f"transaction_id={transaction_id}, "
                f"error={str(e)}"
            )
            # 롤백: Payment 상태를 원래대로 복구
            payment.status = "paid"
            await db.rollback()
            raise
    
    async def update_payment_status(
        self,
        db: AsyncSession,
        payment_id: str,
        new_status: str,
        update_inspection: bool = True
    ) -> Dict[str, Any]:
        """
        결제 상태 변경 (자동 업데이트 로직 포함)
        
        Args:
            db: 데이터베이스 세션
            payment_id: 결제 ID
            new_status: 새 상태 (pending, paid, failed, cancelled, refunded)
            update_inspection: Inspection 상태도 자동 업데이트할지 여부
        
        Returns:
            업데이트된 결제 정보
        """
        # 유효한 상태 확인
        valid_statuses = ["pending", "paid", "failed", "cancelled", "refunded"]
        if new_status not in valid_statuses:
            raise ValueError(f"유효하지 않은 결제 상태입니다: {new_status}")
        
        # Payment 조회
        payment = await self.get_payment(db, payment_id)
        if not payment:
            raise ValueError("결제 정보를 찾을 수 없습니다")
        
        old_status = payment.status
        payment.status = new_status
        
        # paid 상태로 변경 시 paid_at 업데이트
        if new_status == "paid" and not payment.paid_at:
            payment.paid_at = datetime.now()
        
        await db.commit()
        await db.refresh(payment)
        
        # Inspection 상태 자동 업데이트
        if update_inspection:
            inspection_result = await db.execute(
                select(Inspection).where(Inspection.id == payment.inspection_id)
            )
            inspection = inspection_result.scalar_one_or_none()
            
            if inspection:
                # 결제 완료 시 Inspection 상태를 requested로 변경
                if new_status == "paid" and inspection.status not in ["requested", "assigned", "scheduled", "in_progress", "report_submitted", "sent"]:
                    inspection.status = "requested"
                    await db.commit()
                    logger.info(
                        f"Inspection 상태 자동 업데이트: "
                        f"inspection_id={str(inspection.id)}, "
                        f"status=requested (결제 완료)"
                    )
                
                # 결제 취소/환불 시 Inspection 상태를 cancelled로 변경
                elif new_status in ["cancelled", "refunded"]:
                    inspection.status = "cancelled"
                    await db.commit()
                    logger.info(
                        f"Inspection 상태 자동 업데이트: "
                        f"inspection_id={str(inspection.id)}, "
                        f"status=cancelled (결제 취소/환불)"
                    )
        
        # 상태 변경 이벤트 로그
        logger.info(
            f"결제 상태 변경: "
            f"payment_id={str(payment.id)}, "
            f"old_status={old_status}, "
            f"new_status={new_status}"
        )
        
        # 상태 변경 이벤트 발생 시 알림 트리거
        if new_status == "paid" and old_status != "paid":
            from app.services.notification_trigger_service import NotificationTriggerService
            NotificationTriggerService.trigger_payment_completed(
                inspection_id=str(payment.inspection_id),
                user_id=str(inspection.user_id) if inspection else None,
                payment_data={
                    "amount": payment.amount,
                    "method": payment.method,
                    "transaction_id": payment.transaction_id
                }
            )
        
        return {
            "payment_id": str(payment.id),
            "old_status": old_status,
            "new_status": payment.status,
            "updated_at": payment.updated_at
        }
    
    @staticmethod
    async def get_payment_statistics(
        db: AsyncSession,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        결제 통계 조회
        
        Args:
            db: 데이터베이스 세션
            start_date: 시작일
            end_date: 종료일
        
        Returns:
            결제 통계 정보
        """
        # 기본 기간 설정 (없으면 최근 30일)
        if not end_date:
            end_date = date.today()
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        # 상태별 통계
        status_query = select(
            Payment.status,
            func.sum(Payment.amount).label("total_amount"),
            func.count(Payment.id).label("count")
        ).where(
            and_(
                func.date(Payment.created_at) >= start_date,
                func.date(Payment.created_at) <= end_date
            )
        ).group_by(Payment.status)
        
        status_result = await db.execute(status_query)
        status_stats = status_result.all()
        
        status_summary = {}
        total_amount = 0
        total_count = 0
        
        for stat in status_stats:
            status_summary[stat.status] = {
                "count": stat.count,
                "total_amount": int(stat.total_amount or 0)
            }
            if stat.status == "paid":
                total_amount += int(stat.total_amount or 0)
            total_count += stat.count
        
        # 일별 결제 추이 (최근 7일)
        daily_trend = []
        for i in range(6, -1, -1):
            target_date = end_date - timedelta(days=i)
            daily_query = select(
                func.sum(Payment.amount).label("total_amount"),
                func.count(Payment.id).label("count")
            ).where(
                and_(
                    func.date(Payment.created_at) == target_date,
                    Payment.status == "paid"
                )
            )
            daily_result = await db.execute(daily_query)
            daily_stat = daily_result.scalar_one()
            
            daily_trend.append({
                "date": target_date.isoformat(),
                "count": daily_stat.count or 0,
                "total_amount": int(daily_stat.total_amount or 0)
            })
        
        # 결제 수단별 통계
        method_query = select(
            Payment.method,
            func.sum(Payment.amount).label("total_amount"),
            func.count(Payment.id).label("count")
        ).where(
            and_(
                func.date(Payment.created_at) >= start_date,
                func.date(Payment.created_at) <= end_date,
                Payment.status == "paid"
            )
        ).group_by(Payment.method)
        
        method_result = await db.execute(method_query)
        method_stats = method_result.all()
        
        method_summary = {
            stat.method: {
                "count": stat.count,
                "total_amount": int(stat.total_amount or 0)
            }
            for stat in method_stats
        }
        
        # 평균 결제 금액
        avg_query = select(
            func.avg(Payment.amount).label("avg_amount")
        ).where(
            and_(
                func.date(Payment.created_at) >= start_date,
                func.date(Payment.created_at) <= end_date,
                Payment.status == "paid"
            )
        )
        avg_result = await db.execute(avg_query)
        avg_amount = avg_result.scalar_one()
        avg_payment = int(avg_amount.avg_amount or 0) if avg_amount.avg_amount else 0
        
        return {
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "summary": {
                "total_count": total_count,
                "paid_count": status_summary.get("paid", {}).get("count", 0),
                "total_amount": total_amount,
                "avg_payment": avg_payment
            },
            "by_status": status_summary,
            "by_method": method_summary,
            "daily_trend": daily_trend
        }
    
    @staticmethod
    async def get_payment_monitoring(
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        결제 모니터링 정보 조회
        
        Args:
            db: 데이터베이스 세션
        
        Returns:
            결제 모니터링 정보
        """
        today = date.today()
        yesterday = today - timedelta(days=1)
        
        # 오늘 결제 통계
        today_query = select(
            func.sum(Payment.amount).label("total_amount"),
            func.count(Payment.id).label("count")
        ).where(
            and_(
                func.date(Payment.created_at) == today,
                Payment.status == "paid"
            )
        )
        today_result = await db.execute(today_query)
        today_stat = today_result.scalar_one()
        today_amount = int(today_stat.total_amount or 0)
        today_count = today_stat.count or 0
        
        # 어제 결제 통계
        yesterday_query = select(
            func.sum(Payment.amount).label("total_amount"),
            func.count(Payment.id).label("count")
        ).where(
            and_(
                func.date(Payment.created_at) == yesterday,
                Payment.status == "paid"
            )
        )
        yesterday_result = await db.execute(yesterday_query)
        yesterday_stat = yesterday_result.scalar_one()
        yesterday_amount = int(yesterday_stat.total_amount or 0)
        yesterday_count = yesterday_stat.count or 0
        
        # 대기 중인 결제 (pending 상태)
        pending_query = select(func.count(Payment.id)).where(
            Payment.status == "pending"
        )
        pending_result = await db.execute(pending_query)
        pending_count = pending_result.scalar_one() or 0
        
        # 실패한 결제 (최근 24시간)
        failed_query = select(func.count(Payment.id)).where(
            and_(
                Payment.status == "failed",
                Payment.created_at >= datetime.now() - timedelta(hours=24)
            )
        )
        failed_result = await db.execute(failed_query)
        failed_count = failed_result.scalar_one() or 0
        
        # 전일 대비 증감률 계산
        amount_change_rate = 0
        count_change_rate = 0
        if yesterday_amount > 0:
            amount_change_rate = ((today_amount - yesterday_amount) / yesterday_amount) * 100
        if yesterday_count > 0:
            count_change_rate = ((today_count - yesterday_count) / yesterday_count) * 100
        
        return {
            "today": {
                "amount": today_amount,
                "count": today_count
            },
            "yesterday": {
                "amount": yesterday_amount,
                "count": yesterday_count
            },
            "change_rate": {
                "amount": round(amount_change_rate, 2),
                "count": round(count_change_rate, 2)
            },
            "pending_count": pending_count,
            "failed_count_24h": failed_count,
            "updated_at": datetime.now().isoformat()
        }
    
    async def recover_payment_error(
        self,
        db: AsyncSession,
        payment_id: str,
        retry_count: int = 0,
        max_retries: int = 3
    ) -> Dict[str, Any]:
        """
        결제 오류 자동 복구 메커니즘
        
        Args:
            db: 데이터베이스 세션
            payment_id: 결제 ID
            retry_count: 현재 재시도 횟수
            max_retries: 최대 재시도 횟수
        
        Returns:
            복구 결과 데이터
        """
        payment = await self.get_payment(db, payment_id)
        if not payment:
            raise ValueError("결제 정보를 찾을 수 없습니다")
        
        # 상태 불일치 감지 및 동기화
        if payment.status == "pending" and payment.transaction_id:
            try:
                # KCP 결제 상태 동기화
                sync_result = self.kcp_service.sync_payment_status(
                    transaction_id=payment.transaction_id,
                    order_id=payment.transaction_id
                )
                
                # 상태가 실제로는 paid인 경우 업데이트
                if sync_result.get("status") == "paid" and payment.status != "paid":
                    logger.info(
                        f"결제 상태 불일치 감지 및 복구: "
                        f"payment_id={str(payment.id)}, "
                        f"db_status={payment.status}, "
                        f"kcp_status=paid"
                    )
                    
                    # Payment 상태 업데이트
                    payment.status = "paid"
                    payment.paid_at = datetime.now()
                    
                    # Inspection 상태 업데이트
                    inspection_result = await db.execute(
                        select(Inspection).where(Inspection.id == payment.inspection_id)
                    )
                    inspection = inspection_result.scalar_one_or_none()
                    if inspection and inspection.status not in ["requested", "assigned", "scheduled", "in_progress", "report_submitted", "sent"]:
                        inspection.status = "requested"
                    
                    await db.commit()
                    await db.refresh(payment)
                    
                    return {
                        "payment_id": str(payment.id),
                        "recovered": True,
                        "old_status": "pending",
                        "new_status": "paid",
                        "sync_result": sync_result
                    }
            except Exception as e:
                logger.error(f"결제 상태 동기화 실패: {str(e)}")
                if retry_count < max_retries:
                    import asyncio
                    await asyncio.sleep(2 ** retry_count)  # 지수 백오프
                    return await self.recover_payment_error(
                        db=db,
                        payment_id=payment_id,
                        retry_count=retry_count + 1,
                        max_retries=max_retries
                    )
                raise
        
        return {
            "payment_id": str(payment.id),
            "recovered": False,
            "message": "복구할 오류가 없습니다"
        }
    
    async def rollback_payment(
        self,
        db: AsyncSession,
        payment_id: str
    ) -> Dict[str, Any]:
        """
        결제 프로세스 중단 시 자동 롤백
        
        Args:
            db: 데이터베이스 세션
            payment_id: 결제 ID
        
        Returns:
            롤백 결과 데이터
        """
        payment = await self.get_payment(db, payment_id)
        if not payment:
            raise ValueError("결제 정보를 찾을 수 없습니다")
        
        # pending 상태인 경우만 롤백 가능
        if payment.status != "pending":
            raise ValueError("롤백 가능한 상태가 아닙니다 (pending 상태만 롤백 가능)")
        
        old_status = payment.status
        payment.status = "failed"
        
        # Inspection 상태도 롤백
        inspection_result = await db.execute(
            select(Inspection).where(Inspection.id == payment.inspection_id)
        )
        inspection = inspection_result.scalar_one_or_none()
        
        if inspection:
            # Inspection 상태를 이전 상태로 복구 (결제 전 상태)
            # 실제로는 이전 상태를 별도로 저장해야 하지만, 현재는 기본값으로 설정
            if inspection.status == "requested":
                # 결제 전 상태가 없으므로 그대로 유지
                pass
        
        await db.commit()
        await db.refresh(payment)
        
        logger.info(
            f"결제 롤백 완료: "
            f"payment_id={str(payment.id)}, "
            f"old_status={old_status}, "
            f"new_status={payment.status}"
        )
        
        return {
            "payment_id": str(payment.id),
            "old_status": old_status,
            "new_status": payment.status,
            "rolled_back": True
        }

