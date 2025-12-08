"""
견적 산출 서비스 테스트
"""
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from app.services.pricing_service import PricingService
from app.models.package import Package
from app.models.price_policy import PricePolicy
from app.models.service_region import ServiceRegion
from app.models.vehicle_master import VehicleMaster
from unittest.mock import patch, AsyncMock
import uuid


@pytest.mark.asyncio
@pytest.mark.unit
class TestPricingService:
    """견적 산출 서비스 테스트"""
    
    async def test_calculate_quote_basic(
        self,
        db_session: AsyncSession
    ):
        """기본 견적 계산 테스트"""
        # 테스트 데이터 준비
        package_id = uuid.uuid4()
        vehicle_master_id = uuid.uuid4()
        region_id = uuid.uuid4()
        
        # 패키지 생성
        package = Package(
            id=package_id,
            name="라이트A",
            base_price=50000,
            included_items={"exterior": True, "engine": False}
        )
        db_session.add(package)
        
        # 차량 마스터 생성 (국산차, 소형)
        vehicle_master = VehicleMaster(
            id=vehicle_master_id,
            origin="domestic",
            manufacturer="현대",
            model_group="아반떼",
            vehicle_class="small",
            start_year=2020
        )
        db_session.add(vehicle_master)
        
        # 가격 정책 생성 (국산차 소형: 0원)
        price_policy = PricePolicy(
            origin="domestic",
            vehicle_class="small",
            add_amount=0
        )
        db_session.add(price_policy)
        
        # 서비스 지역 생성 (서울 강남구: 0원)
        region = ServiceRegion(
            id=region_id,
            province="서울",
            city="강남구",
            extra_fee=0
        )
        db_session.add(region)
        
        await db_session.commit()
        
        # 견적 계산
        quote = await PricingService.calculate_quote(
            db=db_session,
            package_id=str(package_id),
            vehicle_master_id=str(vehicle_master_id),
            region_id=str(region_id)
        )
        
        # 검증 (응답에 success 키가 없고 직접 필드 반환)
        assert quote["base_price"] == 50000
        assert quote["class_surcharge"] == 0
        assert quote["region_fee"] == 0
        assert quote["total_amount"] == 50000
    
    async def test_calculate_quote_with_surcharge(
        self,
        db_session: AsyncSession
    ):
        """차종 할증이 포함된 견적 계산 테스트"""
        # Redis 모킹
        with patch("app.services.pricing_service.get_redis") as mock_get_redis:
            mock_redis = AsyncMock()
            mock_redis.get.return_value = None
            mock_redis.setex.return_value = True
            mock_get_redis.return_value = mock_redis
            
            # 테스트 데이터 준비
            package_id = uuid.uuid4()
            vehicle_master_id = uuid.uuid4()
            region_id = uuid.uuid4()
            
            # 패키지 생성
            package = Package(
                id=package_id,
                name="스탠다드",
                base_price=100000,
                included_items={"exterior": True, "engine": True}
            )
            db_session.add(package)
            
            # 차량 마스터 생성 (수입차, 대형)
            vehicle_master = VehicleMaster(
                id=vehicle_master_id,
                origin="imported",
                manufacturer="BMW",
                model_group="5시리즈",
                vehicle_class="large",
                start_year=2020
            )
            db_session.add(vehicle_master)
            
            # 가격 정책 생성 (수입차 대형: 30,000원)
            price_policy = PricePolicy(
                origin="imported",
                vehicle_class="large",
                add_amount=30000
            )
            db_session.add(price_policy)
            
            # 서비스 지역 생성 (경기 성남시: 5,000원)
            region = ServiceRegion(
                id=region_id,
                province="경기",
                city="성남시",
                extra_fee=5000
            )
            db_session.add(region)
            
            await db_session.commit()
            
            # 견적 계산
            quote = await PricingService.calculate_quote(
                db=db_session,
                package_id=str(package_id),
                vehicle_master_id=str(vehicle_master_id),
                region_id=str(region_id)
            )
            
            # 검증
            assert quote["base_price"] == 100000
            assert quote["class_surcharge"] == 30000
            assert quote["region_fee"] == 5000
            assert quote["total_amount"] == 135000
    
    async def test_calculate_quote_invalid_package(
        self,
        db_session: AsyncSession
    ):
        """존재하지 않는 패키지 ID로 견적 계산 시도"""
        # Redis 모킹
        with patch("app.services.pricing_service.get_redis") as mock_get_redis:
            mock_redis = AsyncMock()
            mock_redis.get.return_value = None
            mock_get_redis.return_value = mock_redis
            
            vehicle_master_id = uuid.uuid4()
            region_id = uuid.uuid4()
            
            # 차량 마스터 및 지역만 생성
            vehicle_master = VehicleMaster(
                id=vehicle_master_id,
                origin="domestic",
                manufacturer="현대",
                model_group="아반떼",
                vehicle_class="small",
                start_year=2020
            )
            db_session.add(vehicle_master)
            
            region = ServiceRegion(
                id=region_id,
                province="서울",
                city="강남구",
                extra_fee=0
            )
            db_session.add(region)
            await db_session.commit()
            
            # 존재하지 않는 패키지 ID로 견적 계산 시도
            with pytest.raises(ValueError):
                await PricingService.calculate_quote(
                    db=db_session,
                    package_id=str(uuid.uuid4()),  # 존재하지 않는 ID
                    vehicle_master_id=str(vehicle_master_id),
                    region_id=str(region_id)
                )
    
    async def test_calculate_quote_invalid_vehicle(
        self,
        db_session: AsyncSession
    ):
        """존재하지 않는 차량 마스터 ID로 견적 계산 시도"""
        # Redis 모킹
        with patch("app.services.pricing_service.get_redis") as mock_get_redis:
            mock_redis = AsyncMock()
            mock_redis.get.return_value = None
            mock_get_redis.return_value = mock_redis
            
            package_id = uuid.uuid4()
            region_id = uuid.uuid4()
            
            # 패키지 및 지역만 생성
            package = Package(
                id=package_id,
                name="라이트A",
                base_price=50000,
                included_items={}
            )
            db_session.add(package)
            
            region = ServiceRegion(
                id=region_id,
                province="서울",
                city="강남구",
                extra_fee=0
            )
            db_session.add(region)
            await db_session.commit()
            
            # 존재하지 않는 차량 마스터 ID로 견적 계산 시도
            with pytest.raises(ValueError):
                await PricingService.calculate_quote(
                    db=db_session,
                    package_id=str(package_id),
                    vehicle_master_id=str(uuid.uuid4()),  # 존재하지 않는 ID
                    region_id=str(region_id)
                )

