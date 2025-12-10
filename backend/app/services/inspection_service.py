"""
진단 신청 서비스
"""
from typing import Dict, Any, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from datetime import datetime, date, time

from app.models.inspection import Inspection
from app.models.vehicle import Vehicle
from app.models.vehicle_master import VehicleMaster
from app.models.user import User
from app.models.inspection_report import InspectionReport
from app.models.package import Package
from app.models.service_region import ServiceRegion
from app.models.payment import Payment
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
        
        # User 정보 조회 (고객 정보)
        user_result = await db.execute(
            select(User).where(User.id == inspection.user_id)
        )
        user = user_result.scalar_one_or_none()
        
        # Payment 정보 조회
        payment_info = None
        payment_result = await db.execute(
            select(Payment).where(Payment.inspection_id == inspection.id)
        )
        payment = payment_result.scalar_one_or_none()
        if payment:
            from app.core.security import decrypt_phone
            payment_info = {
                "amount": payment.amount,
                "status": payment.status,
                "paid_at": payment.paid_at.isoformat() if payment.paid_at else None
            }
        
        # 차량 정보 문자열 생성
        vehicle_info_str = f"{master.manufacturer} {master.model_group}"
        if master.model_detail:
            vehicle_info_str += f" {master.model_detail}"
        vehicle_info_str += f" ({vehicle.plate_number})"
        
        return {
            "id": str(inspection.id),
            "status": inspection.status,
            "customer": {
                "name": user.name if user else "알 수 없음",
                "phone": decrypt_phone(user.phone) if user and user.phone else None,
                "email": user.email if user else None
            },
            "vehicle": {
                "plate_number": vehicle.plate_number,
                "model": vehicle_info_str,
                "year": vehicle.production_year,
                "mileage": vehicle.mileage
            },
            "vehicle_info": vehicle_info_str,
            "payment": payment_info,
            "schedule": {
                "preferred_date": inspection.schedule_date.isoformat(),
                "preferred_time": inspection.schedule_time.isoformat(),
                "actual_date": None,  # 실제 일시는 나중에 추가 가능
                "actual_time": None
            },
            "inspector": inspector_info,
            "location_address": inspection.location_address,
            "created_at": inspection.created_at.isoformat(),
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
            
            # 고객 정보 조회
            user_result = await db.execute(
                select(User).where(User.id == inspection.user_id)
            )
            user = user_result.scalar_one_or_none()
            
            assignments.append({
                "id": str(inspection.id),
                "location": inspection.location_address or "미확인",
                "vehicle": f"{master.manufacturer} {master.model_group}",
                "plate_number": vehicle.plate_number or "미등록",
                "year": vehicle.year,
                "schedule_date": inspection.schedule_date.isoformat() if inspection.schedule_date else None,
                "schedule_time": inspection.schedule_time.isoformat() if inspection.schedule_time else None,
                "fee": fee,
                "total_amount": inspection.total_amount,
                "customer_name": user.name if user else "미확인",
                "status": inspection.status,
                "created_at": inspection.created_at.isoformat() if inspection.created_at else None
            })
        
        return assignments
    
    @staticmethod
    async def get_my_inspections(
        db: AsyncSession,
        inspector_id: str,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        기사 본인의 진행 중인 작업 목록 조회
        
        Args:
            db: 데이터베이스 세션
            inspector_id: 기사 ID
            status: 상태 필터 (assigned, scheduled, in_progress, report_submitted)
        
        Returns:
            진행 중인 작업 목록
        """
        # 기사가 수락한 작업 목록 조회
        query = select(Inspection).where(
            Inspection.inspector_id == inspector_id
        )
        
        # 상태 필터링
        if status:
            query = query.where(Inspection.status == status)
        else:
            # 진행 중인 상태만 조회 (assigned, scheduled, in_progress, report_submitted)
            query = query.where(
                Inspection.status.in_(["assigned", "scheduled", "in_progress", "report_submitted"])
            )
        
        result = await db.execute(query)
        inspections = result.scalars().all()
        
        my_inspections = []
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
            
            # 고객 정보 조회
            user_result = await db.execute(
                select(User).where(User.id == inspection.user_id)
            )
            user = user_result.scalar_one_or_none()
            
            my_inspections.append({
                "id": str(inspection.id),
                "status": inspection.status,
                "location": inspection.location_address,
                "vehicle": f"{master.manufacturer} {master.model_group}",
                "plate_number": vehicle.plate_number or "미등록",
                "schedule_date": inspection.schedule_date.isoformat() if inspection.schedule_date else None,
                "schedule_time": inspection.schedule_time.isoformat() if inspection.schedule_time else None,
                "customer_name": user.name if user else "미확인",
                "total_amount": inspection.total_amount,
                "created_at": inspection.created_at.isoformat() if inspection.created_at else None
            })
        
        return my_inspections
    
    @staticmethod
    async def get_inspector_dashboard_stats(
        db: AsyncSession,
        inspector_id: str
    ) -> Dict[str, Any]:
        """
        기사 대시보드 통계 조회
        
        Args:
            db: 데이터베이스 세션
            inspector_id: 기사 ID
        
        Returns:
            대시보드 통계 정보
        """
        from datetime import date, timedelta
        
        today = date.today()
        
        # 오늘 일정 수
        today_query = select(func.count()).select_from(Inspection).where(
            and_(
                Inspection.inspector_id == inspector_id,
                Inspection.schedule_date == today,
                Inspection.status.in_(["assigned", "scheduled", "in_progress"])
            )
        )
        today_result = await db.execute(today_query)
        today_count = today_result.scalar_one() or 0
        
        # 신규 배정 요청 수
        new_assignments_query = select(func.count()).select_from(Inspection).where(
            and_(
                or_(
                    Inspection.status == "requested",
                    Inspection.status == "assigned"
                ),
                # 활동 지역 기반 필터링은 나중에 구현
            )
        )
        new_assignments_result = await db.execute(new_assignments_query)
        new_assignments_count = new_assignments_result.scalar_one() or 0
        
        # 진행 중인 작업 수
        in_progress_query = select(func.count()).select_from(Inspection).where(
            and_(
                Inspection.inspector_id == inspector_id,
                Inspection.status.in_(["assigned", "scheduled", "in_progress", "report_submitted"])
            )
        )
        in_progress_result = await db.execute(in_progress_query)
        in_progress_count = in_progress_result.scalar_one() or 0
        
        # 주간 일정 (최근 7일)
        week_start = today - timedelta(days=6)
        weekly_query = select(
            Inspection.schedule_date,
            func.count(Inspection.id).label("count")
        ).where(
            and_(
                Inspection.inspector_id == inspector_id,
                Inspection.schedule_date >= week_start,
                Inspection.schedule_date <= today,
                Inspection.status.in_(["assigned", "scheduled", "in_progress"])
            )
        ).group_by(Inspection.schedule_date)
        
        weekly_result = await db.execute(weekly_query)
        weekly_schedule = {}
        for row in weekly_result.all():
            weekly_schedule[row.schedule_date.isoformat()] = row.count
        
        return {
            "today_count": today_count,
            "new_assignments_count": new_assignments_count,
            "in_progress_count": in_progress_count,
            "weekly_schedule": weekly_schedule
        }
    
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
    
    @staticmethod
    async def update_inspection_status_by_inspector(
        db: AsyncSession,
        inspection_id: str,
        inspector_id: str,
        new_status: str
    ) -> Dict[str, Any]:
        """
        기사가 작업 상태 변경
        
        Args:
            db: 데이터베이스 세션
            inspection_id: 진단 신청 ID
            inspector_id: 기사 ID
            new_status: 새 상태 (scheduled, in_progress, report_submitted)
        
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
        
        # 본인의 작업인지 확인
        if str(inspection.inspector_id) != inspector_id:
            raise ValueError("본인의 작업만 상태를 변경할 수 있습니다")
        
        # 유효한 상태 전환 확인
        valid_transitions = {
            "assigned": ["scheduled", "in_progress"],
            "scheduled": ["in_progress"],
            "in_progress": ["report_submitted"]
        }
        
        current_status = inspection.status
        if current_status not in valid_transitions:
            raise ValueError(f"현재 상태({current_status})에서는 상태를 변경할 수 없습니다")
        
        if new_status not in valid_transitions[current_status]:
            raise ValueError(
                f"상태 {current_status}에서 {new_status}로 변경할 수 없습니다. "
                f"가능한 상태: {', '.join(valid_transitions[current_status])}"
            )
        
        # 상태 변경
        inspection.status = new_status
        await db.commit()
        await db.refresh(inspection)
        
        logger.info(
            f"Inspection 상태 변경: "
            f"inspection_id={str(inspection.id)}, "
            f"inspector_id={inspector_id}, "
            f"old_status={current_status}, "
            f"new_status={new_status}"
        )
        
        return {
            "inspection_id": str(inspection.id),
            "status": inspection.status
        }

