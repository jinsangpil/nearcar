import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, date, time
from unittest.mock import patch
import uuid

from app.models.inspection import Inspection
from app.models.vehicle import Vehicle
from app.models.vehicle_master import VehicleMaster
from app.models.package import Package
from app.models.user import User
from app.models.payment import Payment


@pytest.mark.asyncio
@pytest.mark.api
class TestPaymentsAPI:
    """결제 API 테스트"""

    async def test_request_payment_success(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_token: str
    ):
        """결제 요청 성공 테스트"""
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
            start_year=2020
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
            schedule_date=date.today(),
            schedule_time=time(14, 0),
            location_address="서울시 강남구",
            total_amount=50000
        )
        db_session.add(inspection)
        await db_session.commit()

        # TossPaymentService 모킹
        with patch('app.services.payment_service.TossPaymentService') as MockTossService:
            mock_toss = MockTossService.return_value
            mock_toss.verify_amount.return_value = True
            mock_toss.create_payment.return_value = {
                "paymentKey": "test_payment_key",
                "orderId": f"inspection-{inspection_id}-1234567890",
                "checkoutUrl": "https://checkout.tosspayments.com/test"
            }

            # 결제 요청
            response = await client.post(
                "/api/v1/payments/request",
                headers={"Authorization": f"Bearer {auth_token}"},
                json={
                    "inspection_id": str(inspection_id),
                    "amount": 50000,
                    "customer_info": {
                        "name": "테스트 사용자",
                        "email": "test@example.com",
                        "phone": "01012345678"
                    }
                }
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert "data" in data
            assert "order_id" in data["data"]

    async def test_request_payment_unauthorized(
        self,
        client: AsyncClient
    ):
        """인증되지 않은 사용자의 결제 요청 시도"""
        response = await client.post(
            "/api/v1/payments/request",
            json={
                "inspection_id": str(uuid.uuid4()),
                "amount": 50000,
                "customer_info": {"name": "Test"}
            }
        )

        assert response.status_code in [401, 403]

    async def test_get_payment_status(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_token: str
    ):
        """결제 상태 조회 테스트"""
        inspection_id = uuid.uuid4()
        payment_id = uuid.uuid4()
        vehicle_master_id = uuid.uuid4()
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
            schedule_date=date.today(),
            schedule_time=time(14, 0),
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
            transaction_id="test_transaction_id",
            status="pending"
        )
        db_session.add(payment)
        await db_session.commit()

        # 결제 상태 조회 (엔드포인트는 /api/v1/payments/{payment_id})
        response = await client.get(
            f"/api/v1/payments/{payment_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "data" in data
        assert data["data"]["status"] == "pending"

