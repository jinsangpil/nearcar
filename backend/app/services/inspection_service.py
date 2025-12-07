"""
진단 신청 서비스
"""
from typing import Dict, Any, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from datetime import datetime, date, time

from app.models.inspection import Inspection
from app.models.vehicle import Vehicle
from app.models.vehicle_master import VehicleMaster
from app.models.user import User
from app.models.inspection_report import InspectionReport
from app.models.package import Package
from app.models.service_region import ServiceRegion
from loguru import logger


class InspectionService:
    """진단 신청 서비스"""
    
    @staticmethod
    async def create_inspection(
        db: AsyncSession,
        user_id: str,
        vehicle_master_id: str,
        plate_number: str,
        production_year: int,
        fuel_type: str,
        location_address: str,
        region_id: str,
        preferred_schedule: datetime,
        package_id: str,
        total_amount: int,
        mileage: Optional[int] = None,
        owner_change_cnt: int = 0,
        is_flooded: bool = False
    ) -> Dict[str, Any]:
        """
        진단 신청 생성
        
        Args:
            db: 데이터베이스 세션
            user_id: 사용자 ID
            vehicle_master_id: 차량 마스터 ID
            plate_number: 차량번호
            production_year: 연식
            fuel_type: 연료 타입
            location_address: 진단 장소 주소
            region_id: 서비스 지역 ID
            preferred_schedule: 희망 일정
            package_id: 패키지 ID
            total_amount: 총액
            mileage: 주행거리 (선택)
            owner_change_cnt: 소유자 변경 횟수
            is_flooded: 침수 여부
        
        Returns:
            생성된 Inspection 정보
        """
        # 1. VehicleMaster 조회
        master_result = await db.execute(
            select(VehicleMaster).where(VehicleMaster.id == vehicle_master_id)
        )
        master = master_result.scalar_one_or_none()
        
        if not master:
            raise ValueError("차량 마스터 데이터를 찾을 수 없습니다")
        
        # 2. Vehicle 생성 또는 조회 (동일 차량번호가 있으면 재사용)
        vehicle_result = await db.execute(
            select(Vehicle).where(
                Vehicle.user_id == user_id,
                Vehicle.plate_number == plate_number
            )
        )
        vehicle = vehicle_result.scalar_one_or_none()
        
        if not vehicle:
            vehicle = Vehicle(
                user_id=user_id,
                master_id=vehicle_master_id,
                plate_number=plate_number,
                production_year=production_year,
                fuel_type=fuel_type,
                owner_change_cnt=owner_change_cnt,
                is_flooded=is_flooded
            )
            db.add(vehicle)
            await db.flush()
        else:
            # 기존 차량 정보 업데이트
            vehicle.production_year = production_year
            vehicle.fuel_type = fuel_type
            vehicle.owner_change_cnt = owner_change_cnt
            vehicle.is_flooded = is_flooded
        
        # 3. Inspection 생성
        schedule_date = preferred_schedule.date()
        schedule_time = preferred_schedule.time()
        
        inspection = Inspection(
            user_id=user_id,
            vehicle_id=vehicle.id,
            package_id=package_id,
            status="requested",
            schedule_date=schedule_date,
            schedule_time=schedule_time,
            location_address=location_address,
            total_amount=total_amount
        )
        
        db.add(inspection)
        await db.commit()
        await db.refresh(inspection)
        
        return {
            "inspection_id": str(inspection.id),
            "status": inspection.status
        }
    
    @staticmethod
    async def get_inspection_detail(
        db: AsyncSession,
        inspection_id: str,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        진단 신청 상세 조회
        
        Args:
            db: 데이터베이스 세션
            inspection_id: 진단 신청 ID
            user_id: 조회하는 사용자 ID (권한 검증용)
        
        Returns:
            Inspection 상세 정보
        """
        # Inspection 조회
        result = await db.execute(
            select(Inspection)
            .where(Inspection.id == inspection_id)
        )
        inspection = result.scalar_one_or_none()
        
        if not inspection:
            raise ValueError("진단 신청을 찾을 수 없습니다")
        
        # 권한 검증: 본인 또는 관리자만 조회 가능
        # (관리자 권한 확인은 API 레벨에서 처리)
        
        # Vehicle 정보 조회
        vehicle_result = await db.execute(
            select(Vehicle).where(Vehicle.id == inspection.vehicle_id)
        )
        vehicle = vehicle_result.scalar_one_or_none()
        
        # VehicleMaster 정보 조회
        master_result = await db.execute(
            select(VehicleMaster).where(VehicleMaster.id == vehicle.master_id)
        )
        master = master_result.scalar_one_or_none()
        
        # 기사 정보 조회
        inspector_info = None
        if inspection.inspector_id:
            inspector_result = await db.execute(
                select(User).where(User.id == inspection.inspector_id)
            )
            inspector = inspector_result.scalar_one_or_none()
            if inspector:
                inspector_info = {
                    "name": inspector.name,
                    "phone": None  # 암호화되어 있어서 반환하지 않음
                }
        
        # 레포트 정보 조회
        report_summary = None
        report_result = await db.execute(
            select(InspectionReport).where(InspectionReport.inspection_id == inspection_id)
        )
        report = report_result.scalar_one_or_none()
        
        if report:
            # 레포트 결과 판정 (간단한 로직)
            result = "good"
            if report.repair_cost_est and report.repair_cost_est > 0:
                result = "warning"
            
            report_summary = {
                "result": result,
                "pdf_url": report.pdf_url,
                "web_view_url": f"/report/view/{inspection_id}" if report.pdf_url else None
            }
        
        # 차량 정보 문자열 생성
        vehicle_info = f"{master.manufacturer} {master.model_group}"
        if master.model_detail:
            vehicle_info += f" {master.model_detail}"
        vehicle_info += f" ({vehicle.plate_number})"
        
        return {
            "status": inspection.status,
            "inspector": inspector_info,
            "vehicle_info": vehicle_info,
            "report_summary": report_summary
        }
    
    @staticmethod
    async def get_assignments_for_inspector(
        db: AsyncSession,
        inspector_id: str
    ) -> List[Dict[str, Any]]:
        """
        기사 배정 대기 목록 조회
        
        Args:
            db: 데이터베이스 세션
            inspector_id: 기사 ID
        
        Returns:
            배정 대기 목록
        """
        # 기사 정보 조회 (활동 지역 확인)
        inspector_result = await db.execute(
            select(User).where(User.id == inspector_id)
        )
        inspector = inspector_result.scalar_one_or_none()
        
        if not inspector or inspector.role != "inspector":
            raise ValueError("기사 정보를 찾을 수 없습니다")
        
        # 배정 대기 목록 조회 (requested 또는 assigned 상태)
        query = select(Inspection).where(
            or_(
                Inspection.status == "requested",
                Inspection.status == "assigned"
            )
        )
        
        # 활동 지역 기반 필터링 (나중에 구현 가능)
        # 현재는 모든 배정 대기 목록 반환
        
        result = await db.execute(query)
        inspections = result.scalars().all()
        
        assignments = []
        for inspection in inspections:
            # Vehicle 및 VehicleMaster 정보 조회
            vehicle_result = await db.execute(
                select(Vehicle).where(Vehicle.id == inspection.vehicle_id)
            )
            vehicle = vehicle_result.scalar_one_or_none()
            
            if not vehicle:
                continue
            
            master_result = await db.execute(
                select(VehicleMaster).where(VehicleMaster.id == vehicle.master_id)
            )
            master = master_result.scalar_one_or_none()
            
            if not master:
                continue
            
            # 지역 정보 조회
            region_result = await db.execute(
                select(ServiceRegion).where(ServiceRegion.id == inspection.location_address)  # 임시
            )
            # 실제로는 location_address에서 지역 추출 필요
            
            # 기사 예상 수익 계산 (total_amount * commission_rate)
            fee = inspection.total_amount
            if inspector.commission_rate:
                fee = int(float(inspection.total_amount) * float(inspector.commission_rate))
            
            assignments.append({
                "id": str(inspection.id),
                "location": inspection.location_address.split()[0] if inspection.location_address else "미확인",
                "vehicle": f"{master.manufacturer} {master.model_group}",
                "schedule": f"{inspection.schedule_date} {inspection.schedule_time}",
                "fee": fee
            })
        
        return assignments
    
    @staticmethod
    async def accept_assignment(
        db: AsyncSession,
        inspection_id: str,
        inspector_id: str
    ) -> Dict[str, Any]:
        """
        배정 수락
        
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
        
        if inspection.status not in ["requested", "assigned"]:
            raise ValueError("배정 가능한 상태가 아닙니다")
        
        # Inspection 업데이트
        inspection.inspector_id = inspector_id
        inspection.status = "assigned"
        
        await db.commit()
        await db.refresh(inspection)
        
        # 기사 배정 알림 트리거
        from app.services.notification_trigger_service import NotificationTriggerService
        
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
            "status": inspection.status
        }
    
    @staticmethod
    async def reject_assignment(
        db: AsyncSession,
        inspection_id: str,
        inspector_id: str,
        reason: str
    ) -> Dict[str, Any]:
        """
        배정 거절
        
        Args:
            db: 데이터베이스 세션
            inspection_id: 진단 신청 ID
            inspector_id: 기사 ID
            reason: 거절 사유
        
        Returns:
            거절 결과
        """
        # Inspection 조회
        result = await db.execute(
            select(Inspection).where(Inspection.id == inspection_id)
        )
        inspection = result.scalar_one_or_none()
        
        if not inspection:
            raise ValueError("진단 신청을 찾을 수 없습니다")
        
        # 거절 사유는 로그에만 기록 (현재는 DB에 저장하지 않음)
        logger.info(f"Inspection {inspection_id} rejected by inspector {inspector_id}: {reason}")
        
        # Inspection 상태는 'requested'로 유지 (다른 기사 배정 가능)
        
        return {
            "inspection_id": str(inspection.id),
            "status": "rejected"
        }

