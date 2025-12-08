import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, date, time
from unittest.mock import patch, MagicMock
import uuid

from app.models.inspection import Inspection
from app.models.inspection_report import InspectionReport
from app.models.vehicle import Vehicle
from app.models.vehicle_master import VehicleMaster
from app.models.package import Package
from app.models.user import User


@pytest.mark.asyncio
@pytest.mark.api
class TestReportsAPI:
    """레포트 API 테스트"""

    async def test_generate_report_pdf_success(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_token: str
    ):
        """PDF 생성 요청 성공 테스트"""
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
            status="report_submitted",
            schedule_date=date.today(),
            schedule_time=time(14, 0),
            location_address="서울시 강남구",
            total_amount=50000
        )
        db_session.add(inspection)

        # InspectionReport 생성
        report = InspectionReport(
            id=uuid.uuid4(),
            inspection_id=inspection_id,
            checklist_data={"외관": [{"id": "front_bumper", "status": "normal"}]},
            images=[],
            inspector_comment="테스트 코멘트",
            repair_cost_est=0,
            status="submitted"
        )
        db_session.add(report)
        await db_session.commit()

        # PDF 생성 Task 모킹
        with patch('app.api.v1.reports.generate_inspection_report_pdf') as mock_pdf_task:
            mock_task_result = MagicMock()
            mock_task_result.id = "test_task_id"
            mock_pdf_task.delay = MagicMock(return_value=mock_task_result)

            # PDF 생성 요청
            response = await client.post(
                f"/api/v1/reports/inspections/{inspection_id}/generate-pdf",
                headers={"Authorization": f"Bearer {auth_token}"}
            )

            # PDF 생성 기능이 사용 가능한 경우에만 테스트
            if response.status_code == 503:
                pytest.skip("PDF generation not available (WeasyPrint not installed)")

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True

    async def test_generate_report_pdf_no_checklist(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_token: str
    ):
        """체크리스트가 없는 경우 PDF 생성 요청"""
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

        # Inspection 생성 (체크리스트 없음)
        inspection = Inspection(
            id=inspection_id,
            user_id=test_user.id,
            vehicle_id=vehicle.id,
            package_id=package_id,
            status="assigned",
            schedule_date=date.today(),
            schedule_time=time(14, 0),
            location_address="서울시 강남구",
            total_amount=50000
        )
        db_session.add(inspection)
        await db_session.commit()

        # PDF 생성 요청
        response = await client.post(
            f"/api/v1/reports/inspections/{inspection_id}/generate-pdf",
            headers={"Authorization": f"Bearer {auth_token}"}
        )

        assert response.status_code == 404
        data = response.json()
        assert "체크리스트를 찾을 수 없습니다" in data.get("detail", "")

