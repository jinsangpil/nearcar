import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, date, time
from unittest.mock import patch
import uuid

from app.services.checklist_service import ChecklistService
from app.models.inspection import Inspection
from app.models.inspection_report import InspectionReport
from app.models.vehicle import Vehicle
from app.models.vehicle_master import VehicleMaster
from app.models.package import Package
from app.models.user import User


@pytest.mark.asyncio
@pytest.mark.unit
class TestChecklistService:
    """체크리스트 서비스 테스트"""

    async def test_get_templates(self):
        """체크리스트 템플릿 조회 테스트"""
        templates = ChecklistService.get_templates()

        assert isinstance(templates, list)
        assert len(templates) > 0
        assert "section" in templates[0]
        assert "items" in templates[0]

    async def test_save_checklist_success(
        self,
        db_session: AsyncSession,
        test_inspector_user: User
    ):
        """체크리스트 저장 성공 테스트"""
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
            user_id=test_inspector_user.id,
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

        # Inspection 생성 (assigned 상태)
        inspection = Inspection(
            id=inspection_id,
            user_id=test_inspector_user.id,
            vehicle_id=vehicle.id,
            package_id=package_id,
            inspector_id=test_inspector_user.id,
            status="assigned",
            schedule_date=date.today(),
            schedule_time=time(14, 0),
            location_address="서울시 강남구",
            total_amount=50000
        )
        db_session.add(inspection)
        await db_session.commit()

        # NotificationTriggerService 모킹
        with patch('app.services.notification_trigger_service.NotificationTriggerService.trigger_report_submitted') as mock_trigger:
            # 체크리스트 저장
            checklist_data = {
                "외관": [
                    {"id": "front_bumper", "name": "앞 범퍼", "status": "normal"}
                ],
                "엔진룸": [
                    {"id": "engine_oil", "name": "엔진 오일", "status": "normal"}
                ]
            }

            result = await ChecklistService.save_checklist(
                db=db_session,
                inspection_id=str(inspection_id),
                checklist_data=checklist_data,
                images=[],
                inspector_comment="전반적으로 양호한 상태입니다.",
                repair_cost_est=0
            )

            assert result["report_id"] is not None
            assert result["inspection_id"] == str(inspection_id)
            assert result["status"] == "submitted"

            # DB 상태 확인
            report = await db_session.get(InspectionReport, uuid.UUID(result["report_id"]))
            assert report is not None
            assert report.checklist_data == checklist_data
            assert report.inspector_comment == "전반적으로 양호한 상태입니다."
            assert report.repair_cost_est == 0

            # Inspection 상태 업데이트 확인
            updated_inspection = await db_session.get(Inspection, inspection_id)
            assert updated_inspection.status == "report_submitted"

            # 알림 트리거 호출 확인
            mock_trigger.assert_called_once()

    async def test_save_checklist_invalid_status(
        self,
        db_session: AsyncSession,
        test_inspector_user: User
    ):
        """체크리스트 저장 불가능한 상태에서 저장 시도"""
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
            user_id=test_inspector_user.id,
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

        # Inspection 생성 (requested 상태 - 체크리스트 저장 불가)
        inspection = Inspection(
            id=inspection_id,
            user_id=test_inspector_user.id,
            vehicle_id=vehicle.id,
            package_id=package_id,
            status="requested",  # assigned 또는 in_progress가 아님
            schedule_date=date.today(),
            schedule_time=time(14, 0),
            location_address="서울시 강남구",
            total_amount=50000
        )
        db_session.add(inspection)
        await db_session.commit()

        with pytest.raises(ValueError, match="체크리스트를 작성할 수 있는 상태가 아닙니다"):
            await ChecklistService.save_checklist(
                db=db_session,
                inspection_id=str(inspection_id),
                checklist_data={},
                images=[],
                inspector_comment="테스트",
                repair_cost_est=0
            )

    async def test_get_checklist_success(
        self,
        db_session: AsyncSession,
        test_inspector_user: User
    ):
        """체크리스트 조회 성공 테스트"""
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
            user_id=test_inspector_user.id,
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
            user_id=test_inspector_user.id,
            vehicle_id=vehicle.id,
            package_id=package_id,
            status="assigned",
            schedule_date=date.today(),
            schedule_time=time(14, 0),
            location_address="서울시 강남구",
            total_amount=50000
        )
        db_session.add(inspection)

        # InspectionReport 생성
        checklist_data = {
            "외관": [
                {"id": "front_bumper", "name": "앞 범퍼", "status": "normal"}
            ]
        }
        report = InspectionReport(
            id=uuid.uuid4(),
            inspection_id=inspection_id,
            checklist_data=checklist_data,
            images=[],
            inspector_comment="테스트 코멘트",
            repair_cost_est=100000,
            status="submitted"
        )
        db_session.add(report)
        await db_session.commit()

        # 체크리스트 조회
        result = await ChecklistService.get_checklist(
            db=db_session,
            inspection_id=str(inspection_id)
        )

        assert result is not None
        assert result["inspection_id"] == str(inspection_id)
        assert result["checklist_data"] == checklist_data
        assert result["inspector_comment"] == "테스트 코멘트"
        assert result["repair_cost_est"] == 100000

    async def test_get_checklist_not_found(
        self,
        db_session: AsyncSession
    ):
        """존재하지 않는 체크리스트 조회"""
        result = await ChecklistService.get_checklist(
            db=db_session,
            inspection_id=str(uuid.uuid4())
        )

        assert result is None

