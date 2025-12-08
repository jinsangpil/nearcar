"""
결제 서비스 테스트
"""
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from unittest.mock import patch, MagicMock
import uuid

from app.services.payment_service import PaymentService
from app.models.payment import Payment
from app.models.inspection import Inspection
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.vehicle_master import VehicleMaster
from app.models.package import Package


@pytest.mark.asyncio
@pytest.mark.unit
class TestPaymentService:
    """결제 서비스 테스트"""
    
    @pytest.fixture
    def payment_service(self):
        """PaymentService 인스턴스 생성"""
        return PaymentService()
    
    async def test_request_payment_success(
        self,
        payment_service: PaymentService,
        db_session: AsyncSession,
        test_user: User,
        mock_toss_payment_service
    ):
        """결제 요청 성공 테스트"""
        # 테스트 데이터 준비
        inspection_id = uuid.uuid4()
        vehicle_master_id = uuid.uuid4()
        package_id = uuid.uuid4()
        
        # VehicleMaster 생성
        vehicle_master = VehicleMaster(
            id=vehicle_master_id,
            origin="domestic",
            manufacturer="현대",
            model_group="아반떼",
            vehicle_class="small",
            start_year=2020  # 필수 필드 추가
        )
        db_session.add(vehicle_master)
        
        # Vehicle 생성
        vehicle = Vehicle(
            id=uuid.uuid4(),
            user_id=test_user.id,
            master_id=vehicle_master_id,
            plate_number="12가3456",
            production_year=2020,
            fuel_type="gasoline"
        )
        db_session.add(vehicle)
        
        # Package 생성
        package = Package(
            id=package_id,
            name="라이트A",
            base_price=50000,
            included_items={}
        )
        db_session.add(package)
        
        # Inspection 생성
        inspection = Inspection(
            id=inspection_id,
            user_id=test_user.id,
            vehicle_id=vehicle.id,
            package_id=package_id,
            status="requested",
            schedule_date=datetime.now().date(),
            schedule_time=datetime.now().time(),
            location_address="서울시 강남구",
            total_amount=50000
        )
        db_session.add(inspection)
        await db_session.commit()
        
        # TossPaymentService 모킹
        with patch.object(payment_service, 'toss_service', mock_toss_payment_service):
            mock_toss_payment_service.create_payment.return_value = {
                "paymentKey": "test_payment_key_123",
                "orderId": f"order_{inspection_id}",
                "successUrl": "https://checkout.tosspayments.com/test/success",
                "failUrl": "https://checkout.tosspayments.com/test/fail"
            }
            mock_toss_payment_service.verify_amount.return_value = True
            
            # 결제 요청
            result = await payment_service.request_payment(
                db=db_session,
                inspection_id=str(inspection_id),
                amount=50000,
                customer_info={
                    "name": "테스트 사용자",
                    "email": "test@example.com",
                    "phone": "01012345678"
                }
            )
            
            # 검증
            assert "order_id" in result
            assert "payment_key" in result
            assert result["amount"] == 50000
            
            # Payment 레코드 확인
            from sqlalchemy import select
            from app.models.payment import Payment
            payment_result = await db_session.execute(
                select(Payment).where(Payment.inspection_id == inspection_id)
            )
            payment = payment_result.scalar_one_or_none()
            assert payment is not None
            assert payment.amount == 50000
            assert payment.status == "pending"
    
    async def test_request_payment_invalid_inspection(
        self,
        payment_service: PaymentService,
        db_session: AsyncSession
    ):
        """존재하지 않는 Inspection ID로 결제 요청 시도"""
        with pytest.raises(ValueError, match="진단 신청을 찾을 수 없습니다"):
            await payment_service.request_payment(
                db=db_session,
                inspection_id=str(uuid.uuid4()),  # 존재하지 않는 ID
                amount=50000,
                customer_info={
                    "name": "테스트",
                    "email": "test@example.com",
                    "phone": "01012345678"
                }
            )
    
    async def test_confirm_payment_success(
        self,
        payment_service: PaymentService,
        db_session: AsyncSession,
        test_user: User,
        mock_toss_payment_service
    ):
        """결제 승인 성공 테스트"""
        # 테스트 데이터 준비
        inspection_id = uuid.uuid4()
        payment_id = uuid.uuid4()
        order_id = f"order_{inspection_id}"
        vehicle_master_id = uuid.uuid4()
        vehicle_id = uuid.uuid4()
        package_id = uuid.uuid4()
        
        # VehicleMaster 생성
        vehicle_master = VehicleMaster(
            id=vehicle_master_id,
            origin="domestic",
            manufacturer="현대",
            model_group="아반떼",
            vehicle_class="small",
            start_year=2020
        )
        db_session.add(vehicle_master)
        
        # Vehicle 생성
        vehicle = Vehicle(
            id=vehicle_id,
            user_id=test_user.id,
            master_id=vehicle_master_id,
            plate_number="12가3456",
            production_year=2020,
            fuel_type="gasoline"
        )
        db_session.add(vehicle)
        
        # Package 생성
        package = Package(
            id=package_id,
            name="라이트A",
            base_price=50000,
            included_items={}
        )
        db_session.add(package)
        
        # Inspection 생성
        inspection = Inspection(
            id=inspection_id,
            user_id=test_user.id,
            vehicle_id=vehicle_id,
            package_id=package_id,
            status="requested",
            schedule_date=datetime.now().date(),
            schedule_time=datetime.now().time(),
            location_address="서울시 강남구",
            total_amount=50000
        )
        db_session.add(inspection)
        
        # Payment 생성
        payment = Payment(
            id=payment_id,
            inspection_id=inspection_id,
            amount=50000,
            method="card",
            pg_provider="toss",
            transaction_id=order_id,
            status="pending"
        )
        db_session.add(payment)
        await db_session.commit()
        
        # TossPaymentService 모킹
        with patch.object(payment_service, 'toss_service', mock_toss_payment_service):
            mock_toss_payment_service.confirm_payment.return_value = {
                "transactionKey": "test_transaction_key",
                "method": "card",
                "status": "DONE",
                "totalAmount": 50000
            }
            
            # 결제 승인
            result = await payment_service.confirm_payment(
                db=db_session,
                payment_key="test_payment_key",
                order_id=order_id,
                amount=50000
            )
            
            # 검증
            assert result["status"] == "paid"
            assert result["transaction_id"] == "test_transaction_key"
            assert result["amount"] == 50000
            
            # DB에서 Payment 상태 확인
            await db_session.refresh(payment)
            assert payment.status == "paid"
    
    async def test_confirm_payment_already_paid(
        self,
        payment_service: PaymentService,
        db_session: AsyncSession,
        test_user: User
    ):
        """이미 결제 완료된 결제 승인 시도"""
        # 테스트 데이터 준비
        inspection_id = uuid.uuid4()
        payment_id = uuid.uuid4()
        order_id = f"order_{inspection_id}"
        vehicle_master_id = uuid.uuid4()
        vehicle_id = uuid.uuid4()
        package_id = uuid.uuid4()
        
        # VehicleMaster 생성
        vehicle_master = VehicleMaster(
            id=vehicle_master_id,
            origin="domestic",
            manufacturer="현대",
            model_group="아반떼",
            vehicle_class="small",
            start_year=2020
        )
        db_session.add(vehicle_master)
        
        # Vehicle 생성
        vehicle = Vehicle(
            id=vehicle_id,
            user_id=test_user.id,
            master_id=vehicle_master_id,
            plate_number="12가3456",
            production_year=2020,
            fuel_type="gasoline"
        )
        db_session.add(vehicle)
        
        # Package 생성
        package = Package(
            id=package_id,
            name="라이트A",
            base_price=50000,
            included_items={}
        )
        db_session.add(package)
        
        # Inspection 생성
        inspection = Inspection(
            id=inspection_id,
            user_id=test_user.id,
            vehicle_id=vehicle_id,
            package_id=package_id,
            status="requested",
            schedule_date=datetime.now().date(),
            schedule_time=datetime.now().time(),
            location_address="서울시 강남구",
            total_amount=50000
        )
        db_session.add(inspection)
        
        # Payment 생성 (이미 결제 완료 상태)
        payment = Payment(
            id=payment_id,
            inspection_id=inspection_id,
            amount=50000,
            method="card",
            pg_provider="toss",
            transaction_id=order_id,
            status="paid",
            paid_at=datetime.now()
        )
        db_session.add(payment)
        await db_session.commit()
        
        # 이미 결제 완료된 결제 승인 시도
        with pytest.raises(ValueError, match="이미 결제가 완료되었습니다"):
            await payment_service.confirm_payment(
                db=db_session,
                payment_key="test_payment_key",
                order_id=order_id,
                amount=50000
            )
    
    async def test_confirm_payment_amount_mismatch(
        self,
        payment_service: PaymentService,
        db_session: AsyncSession,
        test_user: User
    ):
        """결제 금액 불일치 테스트"""
        # 테스트 데이터 준비
        inspection_id = uuid.uuid4()
        payment_id = uuid.uuid4()
        order_id = f"order_{inspection_id}"
        vehicle_master_id = uuid.uuid4()
        vehicle_id = uuid.uuid4()
        package_id = uuid.uuid4()
        
        # VehicleMaster 생성
        vehicle_master = VehicleMaster(
            id=vehicle_master_id,
            origin="domestic",
            manufacturer="현대",
            model_group="아반떼",
            vehicle_class="small",
            start_year=2020
        )
        db_session.add(vehicle_master)
        
        # Vehicle 생성
        vehicle = Vehicle(
            id=vehicle_id,
            user_id=test_user.id,
            master_id=vehicle_master_id,
            plate_number="12가3456",
            production_year=2020,
            fuel_type="gasoline"
        )
        db_session.add(vehicle)
        
        # Package 생성
        package = Package(
            id=package_id,
            name="라이트A",
            base_price=50000,
            included_items={}
        )
        db_session.add(package)
        
        # Inspection 생성
        inspection = Inspection(
            id=inspection_id,
            user_id=test_user.id,
            vehicle_id=vehicle_id,
            package_id=package_id,
            status="requested",
            schedule_date=datetime.now().date(),
            schedule_time=datetime.now().time(),
            location_address="서울시 강남구",
            total_amount=50000
        )
        db_session.add(inspection)
        
        # Payment 생성 (금액: 50000원)
        payment = Payment(
            id=payment_id,
            inspection_id=inspection_id,
            amount=50000,
            method="card",
            pg_provider="toss",
            transaction_id=order_id,
            status="pending"
        )
        db_session.add(payment)
        await db_session.commit()
        
        # 다른 금액으로 결제 승인 시도 (10000원)
        with pytest.raises(ValueError, match="결제 금액이 일치하지 않습니다"):
            await payment_service.confirm_payment(
                db=db_session,
                payment_key="test_payment_key",
                order_id=order_id,
                amount=10000  # 실제 금액과 다름
            )

