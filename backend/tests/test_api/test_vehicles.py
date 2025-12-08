import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.models.vehicle_master import VehicleMaster


@pytest.mark.asyncio
@pytest.mark.api
class TestVehiclesAPI:
    """차량 마스터 API 테스트"""

    async def test_get_manufacturers(
        self,
        client: AsyncClient,
        db_session: AsyncSession
    ):
        """제조사 목록 조회 테스트"""
        # 테스트 데이터 생성
        vehicle_master1 = VehicleMaster(
            id=uuid.uuid4(),
            origin="domestic",
            manufacturer="현대",
            model_group="아반떼",
            vehicle_class="small",
            start_year=2020
        )
        vehicle_master2 = VehicleMaster(
            id=uuid.uuid4(),
            origin="imported",
            manufacturer="BMW",
            model_group="3시리즈",
            vehicle_class="medium",
            start_year=2020
        )
        db_session.add_all([vehicle_master1, vehicle_master2])
        await db_session.commit()

        # 제조사 목록 조회
        response = await client.get("/api/v1/vehicles/manufacturers")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "data" in data
        assert isinstance(data["data"], list)

    async def test_get_manufacturers_with_origin_filter(
        self,
        client: AsyncClient,
        db_session: AsyncSession
    ):
        """제조사 목록 조회 (국산/수입 필터) 테스트"""
        # 테스트 데이터 생성
        vehicle_master1 = VehicleMaster(
            id=uuid.uuid4(),
            origin="domestic",
            manufacturer="현대",
            model_group="아반떼",
            vehicle_class="small",
            start_year=2020
        )
        vehicle_master2 = VehicleMaster(
            id=uuid.uuid4(),
            origin="imported",
            manufacturer="BMW",
            model_group="3시리즈",
            vehicle_class="medium",
            start_year=2020
        )
        db_session.add_all([vehicle_master1, vehicle_master2])
        await db_session.commit()

        # 국산차만 조회
        response = await client.get("/api/v1/vehicles/manufacturers?origin=domestic")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "data" in data

    async def test_get_manufacturers_invalid_origin(
        self,
        client: AsyncClient
    ):
        """잘못된 origin 파라미터로 제조사 목록 조회 시도"""
        response = await client.get("/api/v1/vehicles/manufacturers?origin=invalid")

        assert response.status_code == 400
        data = response.json()
        assert "detail" in data

    async def test_get_model_groups(
        self,
        client: AsyncClient,
        db_session: AsyncSession
    ):
        """모델 그룹 목록 조회 테스트"""
        # 테스트 데이터 생성
        vehicle_master = VehicleMaster(
            id=uuid.uuid4(),
            origin="domestic",
            manufacturer="현대",
            model_group="아반떼",
            vehicle_class="small",
            start_year=2020
        )
        db_session.add(vehicle_master)
        await db_session.commit()

        # 모델 그룹 목록 조회
        response = await client.get("/api/v1/vehicles/model-groups?manufacturer=현대")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "data" in data

