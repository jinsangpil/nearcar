"""
운영자 관리 서비스
"""
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc, asc
from datetime import date

from app.models.vehicle_master import VehicleMaster
from app.models.price_policy import PricePolicy
from app.models.inspection import Inspection
from app.models.settlement import Settlement
from app.models.user import User
from app.models.package import Package
from app.services.pricing_service import PricingService
from loguru import logger


class AdminService:
    """운영자 관리 서비스"""
    
    @staticmethod
    async def create_or_update_vehicle_master(
        db: AsyncSession,
        origin: str,
        manufacturer: str,
        model_group: str,
        model_detail: Optional[str],
        vehicle_class: str,
        start_year: int,
        end_year: Optional[int]
    ) -> Dict[str, Any]:
        """
        차량 마스터 데이터 생성 또는 업데이트
        
        Args:
            db: 데이터베이스 세션
            origin: 국산/수입
            manufacturer: 제조사
            model_group: 모델 그룹
            model_detail: 모델 상세
            vehicle_class: 차량 등급
            start_year: 출시 시작 연도
            end_year: 출시 종료 연도
        
        Returns:
            생성/업데이트된 VehicleMaster 정보
        """
        # 기존 레코드 확인
        query = select(VehicleMaster).where(
            and_(
                VehicleMaster.origin == origin,
                VehicleMaster.manufacturer == manufacturer,
                VehicleMaster.model_group == model_group,
                VehicleMaster.model_detail == model_detail
            )
        )
        
        result = await db.execute(query)
        existing = result.scalar_one_or_none()
        
        if existing:
            # 업데이트
            existing.vehicle_class = vehicle_class
            existing.start_year = start_year
            existing.end_year = end_year
            await db.commit()
            await db.refresh(existing)
            return {
                "id": str(existing.id),
                "action": "updated"
            }
        else:
            # 생성
            new_master = VehicleMaster(
                origin=origin,
                manufacturer=manufacturer,
                model_group=model_group,
                model_detail=model_detail,
                vehicle_class=vehicle_class,
                start_year=start_year,
                end_year=end_year
            )
            db.add(new_master)
            await db.commit()
            await db.refresh(new_master)
            return {
                "id": str(new_master.id),
                "action": "created"
            }
    
    @staticmethod
    async def create_or_update_price_policy(
        db: AsyncSession,
        origin: str,
        vehicle_class: str,
        add_amount: int
    ) -> Dict[str, Any]:
        """
        가격 정책 생성 또는 업데이트
        
        Args:
            db: 데이터베이스 세션
            origin: 국산/수입
            vehicle_class: 차량 등급
            add_amount: 추가 금액
        
        Returns:
            생성/업데이트된 PricePolicy 정보
        """
        # 기존 레코드 확인
        query = select(PricePolicy).where(
            and_(
                PricePolicy.origin == origin,
                PricePolicy.vehicle_class == vehicle_class
            )
        )
        
        result = await db.execute(query)
        existing = result.scalar_one_or_none()
        
        if existing:
            # 업데이트
            existing.add_amount = add_amount
            await db.commit()
            await db.refresh(existing)
            
            # Redis 캐시 무효화
            await PricingService.invalidate_cache("quote:*")
            
            return {
                "id": str(existing.id),
                "action": "updated"
            }
        else:
            # 생성
            new_policy = PricePolicy(
                origin=origin,
                vehicle_class=vehicle_class,
                add_amount=add_amount
            )
            db.add(new_policy)
            await db.commit()
            await db.refresh(new_policy)
            
            # Redis 캐시 무효화
            await PricingService.invalidate_cache("quote:*")
            
            return {
                "id": str(new_policy.id),
                "action": "created"
            }
    
    @staticmethod
    async def get_inspections(
        db: AsyncSession,
        status: Optional[str] = None,
        region: Optional[str] = None,
        target_date: Optional[date] = None,
        page: int = 1,
        limit: int = 20,
        sort_by: str = "created_at",
        sort_order: str = "desc"
    ) -> Dict[str, Any]:
        """
        신청 목록 조회 (필터링, 정렬, 페이지네이션)
        
        Args:
            db: 데이터베이스 세션
            status: 상태 필터
            region: 지역 필터
            target_date: 날짜 필터
            page: 페이지 번호
            limit: 페이지 크기
            sort_by: 정렬 기준
            sort_order: 정렬 순서
        
        Returns:
            신청 목록 및 페이지네이션 정보
        """
        # 기본 쿼리
        query = select(Inspection)
        
        # 필터링
        conditions = []
        if status:
            conditions.append(Inspection.status == status)
        if target_date:
            conditions.append(Inspection.schedule_date == target_date)
        # region 필터링은 location_address에서 추출 필요 (나중에 구현)
        
        if conditions:
            query = query.where(and_(*conditions))
        
        # 정렬
        sort_column = getattr(Inspection, sort_by, Inspection.created_at)
        if sort_order == "desc":
            query = query.order_by(desc(sort_column))
        else:
            query = query.order_by(asc(sort_column))
        
        # 전체 개수 조회
        count_query = select(func.count()).select_from(query.subquery())
        count_result = await db.execute(count_query)
        total = count_result.scalar_one()
        
        # 페이지네이션
        offset = (page - 1) * limit
        query = query.offset(offset).limit(limit)
        
        # 데이터 조회
        result = await db.execute(query)
        inspections = result.scalars().all()
        
        # 응답 데이터 구성
        inspection_list = []
        for inspection in inspections:
            # Vehicle 정보 조회
            vehicle_result = await db.execute(
                select(Vehicle).where(Vehicle.id == inspection.vehicle_id)
            )
            vehicle = vehicle_result.scalar_one_or_none()
            
            inspection_list.append({
                "id": str(inspection.id),
                "user_id": str(inspection.user_id),
                "inspector_id": str(inspection.inspector_id) if inspection.inspector_id else None,
                "vehicle_id": str(inspection.vehicle_id),
                "plate_number": vehicle.plate_number if vehicle else None,
                "status": inspection.status,
                "schedule_date": inspection.schedule_date.isoformat(),
                "schedule_time": inspection.schedule_time.isoformat(),
                "location_address": inspection.location_address,
                "total_amount": inspection.total_amount,
                "created_at": inspection.created_at.isoformat()
            })
        
        return {
            "items": inspection_list,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit
        }
    
    @staticmethod
    async def assign_inspector(
        db: AsyncSession,
        inspection_id: str,
        inspector_id: str
    ) -> Dict[str, Any]:
        """
        강제 배정
        
        Args:
            db: 데이터베이스 세션
            inspection_id: 진단 신청 ID
            inspector_id: 기사 ID
        
        Returns:
            업데이트된 Inspection 정보
        """
        # Inspection 조회
        result = await db.execute(
            select(Inspection).where(Inspection.id == inspection_id)
        )
        inspection = result.scalar_one_or_none()
        
        if not inspection:
            raise ValueError("진단 신청을 찾을 수 없습니다")
        
        # 기사 정보 확인
        inspector_result = await db.execute(
            select(User).where(User.id == inspector_id)
        )
        inspector = inspector_result.scalar_one_or_none()
        
        if not inspector or inspector.role != "inspector":
            raise ValueError("기사 정보를 찾을 수 없습니다")
        
        # Inspection 업데이트
        inspection.inspector_id = inspector_id
        inspection.status = "assigned"
        
        await db.commit()
        await db.refresh(inspection)
        
        # 기사 배정 알림 트리거
        from app.services.notification_trigger_service import NotificationTriggerService
        from app.services.inspection_service import InspectionService
        
        # Inspection 상세 정보 조회
        inspection_detail = await InspectionService.get_inspection_detail(
            db=db,
            inspection_id=str(inspection.id),
            user_id=str(inspection.user_id)
        )
        
        # 기사 정보 추가
        inspector_result = await db.execute(
            select(User).where(User.id == inspector_id)
        )
        inspector = inspector_result.scalar_one_or_none()
        if inspector:
            from app.core.security import decrypt_phone
            inspection_detail["inspector_name"] = inspector.name or ""
            inspection_detail["inspector_phone"] = decrypt_phone(inspector.phone) if inspector.phone else ""
        
        NotificationTriggerService.trigger_inspection_assigned(
            inspection_id=str(inspection.id),
            user_id=str(inspection.user_id),
            inspector_id=str(inspector_id),
            inspection_data=inspection_detail
        )
        
        return {
            "inspection_id": str(inspection.id),
            "inspector_id": str(inspection.inspector_id),
            "status": inspection.status
        }
    
    @staticmethod
    async def calculate_settlements(
        db: AsyncSession,
        target_date: date
    ) -> Dict[str, Any]:
        """
        정산 집계
        
        Args:
            db: 데이터베이스 세션
            target_date: 정산 기준일
        
        Returns:
            정산 집계 결과
        """
        # 해당 날짜에 완료된 Inspection 조회
        query = select(Inspection).where(
            and_(
                Inspection.status == "sent",  # 발송 완료된 건만
                Inspection.schedule_date == target_date,
                Inspection.inspector_id.isnot(None)
            )
        )
        
        result = await db.execute(query)
        inspections = result.scalars().all()
        
        settlements_created = 0
        
        for inspection in inspections:
            # 기존 Settlement 확인
            existing_result = await db.execute(
                select(Settlement).where(Settlement.inspection_id == inspection.id)
            )
            existing = existing_result.scalar_one_or_none()
            
            if existing:
                continue  # 이미 정산된 건은 스킵
            
            # 기사 정보 조회
            inspector_result = await db.execute(
                select(User).where(User.id == inspection.inspector_id)
            )
            inspector = inspector_result.scalar_one_or_none()
            
            if not inspector or not inspector.commission_rate:
                continue
            
            # 정산 금액 계산
            fee_rate = float(inspector.commission_rate)
            settle_amount = int(float(inspection.total_amount) * fee_rate)
            
            # Settlement 생성
            settlement = Settlement(
                inspector_id=inspection.inspector_id,
                inspection_id=inspection.id,
                total_sales=inspection.total_amount,
                fee_rate=fee_rate,
                settle_amount=settle_amount,
                status="pending",
                settle_date=target_date
            )
            
            db.add(settlement)
            settlements_created += 1
        
        await db.commit()
        
        return {
            "target_date": target_date.isoformat(),
            "settlements_created": settlements_created,
            "total_inspections": len(inspections)
        }

