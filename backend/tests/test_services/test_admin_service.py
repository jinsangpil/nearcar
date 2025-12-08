import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date, time
from unittest.mock import patch, AsyncMock
import uuid

from app.services.admin_service import AdminService
from app.models.vehicle_master import VehicleMaster
from app.models.price_policy import PricePolicy
from app.models.inspection import Inspection
from app.models.vehicle import Vehicle
from app.models.user import User
from app.models.package import Package
from app.core.security import encrypt_phone


@pytest.mark.asyncio
@pytest.mark.unit
class TestAdminService:
    """운영자 관리 서비스 테스트"""

    async def test_create_or_update_vehicle_master_create(
        self,
        db_session: AsyncSession
    ):
        """차량 마스터 생성 테스트"""
        # Redis 모킹
        with patch("app.services.pricing_service.get_redis") as mock_get_redis:
            mock_redis = AsyncMock()
            mock_get_redis.return_value = mock_redis

            result = await AdminService.create_or_update_vehicle_master(
                db=db_session,
                origin="domestic",
                manufacturer="현대",
                model_group="아반떼",
                model_detail="AD",
                vehicle_class="small",
                start_year=2020,
                end_year=None
            )

            assert result["id"] is not None
            assert result["action"] == "created"

            # DB에 저장된 VehicleMaster 확인
            vehicle_master = await db_session.get(VehicleMaster, uuid.UUID(result["id"]))
            assert vehicle_master is not None
            assert vehicle_master.manufacturer == "현대"
            assert vehicle_master.model_group == "아반떼"

    async def test_create_or_update_vehicle_master_update(
        self,
        db_session: AsyncSession
    ):
        """차량 마스터 업데이트 테스트"""
        vehicle_master_id = uuid.uuid4()

        # 기존 VehicleMaster 생성
        vehicle_master = VehicleMaster(
            id=vehicle_master_id,
            origin="domestic",
            manufacturer="현대",
            model_group="아반떼",
            model_detail="AD",
            vehicle_class="small",
            start_year=2020
        )
        db_session.add(vehicle_master)
        await db_session.commit()

        # Redis 모킹
        with patch("app.services.pricing_service.get_redis") as mock_get_redis:
            mock_redis = AsyncMock()
            mock_get_redis.return_value = mock_redis

            # 업데이트
            result = await AdminService.create_or_update_vehicle_master(
                db=db_session,
                origin="domestic",
                manufacturer="현대",
                model_group="아반떼",
                model_detail="AD",
                vehicle_class="medium",  # 변경
                start_year=2021,  # 변경
                end_year=None
            )

            assert result["id"] == str(vehicle_master_id)
            assert result["action"] == "updated"

            # DB 상태 확인
            updated_master = await db_session.get(VehicleMaster, vehicle_master_id)
            assert updated_master.vehicle_class == "medium"
            assert updated_master.start_year == 2021

    async def test_create_or_update_price_policy_create(
        self,
        db_session: AsyncSession
    ):
        """가격 정책 생성 테스트"""
        # Redis 모킹
        with patch("app.services.pricing_service.get_redis") as mock_get_redis:
            mock_redis = AsyncMock()
            mock_get_redis.return_value = mock_redis

            result = await AdminService.create_or_update_price_policy(
                db=db_session,
                origin="domestic",
                vehicle_class="small",
                add_amount=0
            )

            assert result["id"] is not None
            assert result["action"] == "created"

            # DB에 저장된 PricePolicy 확인
            price_policy = await db_session.get(PricePolicy, uuid.UUID(result["id"]))
            assert price_policy is not None
            assert price_policy.add_amount == 0

    async def test_get_inspections_with_filters(
        self,
        db_session: AsyncSession,
        test_user: User
    ):
        """필터링된 신청 목록 조회 테스트"""
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

        # Inspection 생성 (requested 상태)
        inspection = Inspection(
            id=uuid.uuid4(),
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

        # 필터링된 목록 조회
        result = await AdminService.get_inspections(
            db=db_session,
            status="requested",
            page=1,
            limit=20
        )

        assert result["total"] >= 1
        assert len(result["items"]) >= 1
        assert result["items"][0]["status"] == "requested"

    async def test_assign_inspector_success(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_inspector_user: User
    ):
        """기사 강제 배정 성공 테스트"""
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

        # NotificationTriggerService 모킹
        with patch('app.services.notification_trigger_service.NotificationTriggerService.trigger_inspection_assigned') as mock_trigger:
            # 기사 배정
            result = await AdminService.assign_inspector(
                db=db_session,
                inspection_id=str(inspection_id),
                inspector_id=str(test_inspector_user.id)
            )

            assert result["inspection_id"] == str(inspection_id)
            assert result["inspector_id"] == str(test_inspector_user.id)
            assert result["status"] == "assigned"

            # DB 상태 확인
            updated_inspection = await db_session.get(Inspection, inspection_id)
            assert updated_inspection.status == "assigned"
            assert updated_inspection.inspector_id == test_inspector_user.id

            # 알림 트리거 호출 확인
            mock_trigger.assert_called_once()

    async def test_assign_inspector_invalid_inspector(
        self,
        db_session: AsyncSession,
        test_user: User
    ):
        """기사가 아닌 사용자로 배정 시도"""
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

        # 일반 사용자로 배정 시도 (기사가 아님)
        with pytest.raises(ValueError, match="기사 정보를 찾을 수 없습니다"):
            await AdminService.assign_inspector(
                db=db_session,
                inspection_id=str(inspection_id),
                inspector_id=str(test_user.id)  # 일반 사용자
            )

