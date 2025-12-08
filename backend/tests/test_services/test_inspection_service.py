import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, date, time
from unittest.mock import patch, AsyncMock
import uuid

from app.services.inspection_service import InspectionService
from app.models.inspection import Inspection
from app.models.vehicle import Vehicle
from app.models.vehicle_master import VehicleMaster
from app.models.package import Package
from app.models.user import User
from app.core.security import encrypt_phone


@pytest.mark.asyncio
@pytest.mark.unit
class TestInspectionService:
    """진단 신청 서비스 테스트"""

    async def test_create_inspection_success(
        self,
        db_session: AsyncSession,
        test_user: User
    ):
        """진단 신청 생성 성공 테스트"""
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

        # Package 생성
        package = Package(
            id=package_id,
            name="라이트A",
            base_price=50000,
            included_items={}
        )
        db_session.add(package)
        await db_session.commit()

        # 진단 신청 생성
        result = await InspectionService.create_inspection(
            db=db_session,
            user_id=str(test_user.id),
            vehicle_master_id=str(vehicle_master_id),
            plate_number="12가3456",
            production_year=2020,
            fuel_type="gasoline",
            location_address="서울시 강남구",
            region_id=str(uuid.uuid4()),
            preferred_schedule=datetime.now(),
            package_id=str(package_id),
            total_amount=50000
        )

        assert result["inspection_id"] is not None
        assert result["status"] == "requested"

        # DB에 저장된 Inspection 확인
        inspection = await db_session.get(Inspection, uuid.UUID(result["inspection_id"]))
        assert inspection is not None
        assert inspection.user_id == test_user.id
        assert inspection.status == "requested"

    async def test_create_inspection_invalid_master(
        self,
        db_session: AsyncSession,
        test_user: User
    ):
        """존재하지 않는 차량 마스터로 진단 신청 생성 시도"""
        package_id = uuid.uuid4()

        # Package만 생성
        package = Package(
            id=package_id,
            name="라이트A",
            base_price=50000,
            included_items={}
        )
        db_session.add(package)
        await db_session.commit()

        with pytest.raises(ValueError, match="차량 마스터 데이터를 찾을 수 없습니다"):
            await InspectionService.create_inspection(
                db=db_session,
                user_id=str(test_user.id),
                vehicle_master_id=str(uuid.uuid4()),  # 존재하지 않는 ID
                plate_number="12가3456",
                production_year=2020,
                fuel_type="gasoline",
                location_address="서울시 강남구",
                region_id=str(uuid.uuid4()),
                preferred_schedule=datetime.now(),
                package_id=str(package_id),
                total_amount=50000
            )

    async def test_get_inspection_detail_success(
        self,
        db_session: AsyncSession,
        test_user: User
    ):
        """진단 신청 상세 조회 성공 테스트"""
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

        # 상세 조회
        result = await InspectionService.get_inspection_detail(
            db=db_session,
            inspection_id=str(inspection_id),
            user_id=str(test_user.id)
        )

        assert result["status"] == "requested"
        assert "vehicle_info" in result
        assert "12가3456" in result["vehicle_info"]

    async def test_get_inspection_detail_not_found(
        self,
        db_session: AsyncSession
    ):
        """존재하지 않는 진단 신청 조회 시도"""
        with pytest.raises(ValueError, match="진단 신청을 찾을 수 없습니다"):
            await InspectionService.get_inspection_detail(
                db=db_session,
                inspection_id=str(uuid.uuid4())
            )

    async def test_accept_assignment_success(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_inspector_user: User
    ):
        """배정 수락 성공 테스트"""
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

        # Inspection 생성 (requested 상태)
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
            # 배정 수락
            result = await InspectionService.accept_assignment(
                db=db_session,
                inspection_id=str(inspection_id),
                inspector_id=str(test_inspector_user.id)
            )

            assert result["inspection_id"] == str(inspection_id)
            assert result["status"] == "assigned"

            # DB 상태 확인
            updated_inspection = await db_session.get(Inspection, inspection_id)
            assert updated_inspection.status == "assigned"
            assert updated_inspection.inspector_id == test_inspector_user.id

            # 알림 트리거 호출 확인
            mock_trigger.assert_called_once()

    async def test_accept_assignment_invalid_status(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_inspector_user: User
    ):
        """배정 불가능한 상태에서 배정 수락 시도"""
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

        # Inspection 생성 (completed 상태)
        inspection = Inspection(
            id=inspection_id,
            user_id=test_user.id,
            vehicle_id=vehicle.id,
            package_id=package_id,
            status="completed",  # 배정 불가능한 상태
            schedule_date=date.today(),
            schedule_time=time(14, 0),
            location_address="서울시 강남구",
            total_amount=50000
        )
        db_session.add(inspection)
        await db_session.commit()

        with pytest.raises(ValueError, match="배정 가능한 상태가 아닙니다"):
            await InspectionService.accept_assignment(
                db=db_session,
                inspection_id=str(inspection_id),
                inspector_id=str(test_inspector_user.id)
            )

    async def test_reject_assignment_success(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_inspector_user: User
    ):
        """배정 거절 성공 테스트"""
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

        # 배정 거절
        result = await InspectionService.reject_assignment(
            db=db_session,
            inspection_id=str(inspection_id),
            inspector_id=str(test_inspector_user.id),
            reason="일정이 맞지 않습니다"
        )

        assert result["inspection_id"] == str(inspection_id)
        assert result["status"] == "rejected"

        # DB 상태 확인 (상태는 'requested'로 유지되어야 함)
        updated_inspection = await db_session.get(Inspection, inspection_id)
        assert updated_inspection.status == "requested"  # 거절해도 상태는 유지

