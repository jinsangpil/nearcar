"""
정산 비즈니스 로직 서비스
"""
from typing import Dict, Any, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.orm import selectinload
from datetime import date, datetime, timedelta
from decimal import Decimal
import uuid

from app.models.settlement import Settlement
from app.models.inspection import Inspection
from app.models.user import User
from app.models.payment import Payment
from loguru import logger


class SettlementService:
    """정산 비즈니스 로직 서비스"""
    
    @staticmethod
    async def get_settlements(
        db: AsyncSession,
        inspector_id: Optional[str] = None,
        status: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        page: int = 1,
        page_size: int = 20,
        sort_by: str = "settle_date",
        sort_order: str = "desc"
    ) -> Dict[str, Any]:
        """
        정산 내역 목록 조회
        
        Args:
            db: 데이터베이스 세션
            inspector_id: 기사 ID (필터링)
            status: 정산 상태 (필터링)
            start_date: 시작일 (필터링)
            end_date: 종료일 (필터링)
            page: 페이지 번호
            page_size: 페이지 크기
            sort_by: 정렬 기준
            sort_order: 정렬 순서 (asc, desc)
        
        Returns:
            정산 내역 목록 및 페이지네이션 정보
        """
        # 기본 쿼리
        query = select(Settlement).options(
            selectinload(Settlement.inspector),
            selectinload(Settlement.inspection)
        )
        
        # 필터링
        conditions = []
        
        if inspector_id:
            try:
                inspector_uuid = uuid.UUID(inspector_id)
                conditions.append(Settlement.inspector_id == inspector_uuid)
            except ValueError:
                raise ValueError("유효하지 않은 기사 ID 형식입니다")
        
        if status:
            conditions.append(Settlement.status == status)
        
        if start_date:
            conditions.append(Settlement.settle_date >= start_date)
        
        if end_date:
            conditions.append(Settlement.settle_date <= end_date)
        
        if conditions:
            query = query.where(and_(*conditions))
        
        # 정렬
        if sort_by == "settle_date":
            sort_column = Settlement.settle_date
        elif sort_by == "settle_amount":
            sort_column = Settlement.settle_amount
        elif sort_by == "created_at":
            sort_column = Settlement.created_at
        else:
            sort_column = Settlement.settle_date
        
        if sort_order == "desc":
            query = query.order_by(desc(sort_column))
        else:
            query = query.order_by(sort_column)
        
        # 전체 개수 조회
        count_query = select(func.count()).select_from(Settlement)
        if conditions:
            count_query = count_query.where(and_(*conditions))
        
        count_result = await db.execute(count_query)
        total = count_result.scalar()
        
        # 페이지네이션
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)
        
        # 결과 조회
        result = await db.execute(query)
        settlements = result.scalars().all()
        
        # 응답 데이터 구성
        settlement_list = []
        for settlement in settlements:
            settlement_data = {
                "id": str(settlement.id),
                "inspector_id": str(settlement.inspector_id),
                "inspector_name": settlement.inspector.name if settlement.inspector else None,
                "inspection_id": str(settlement.inspection_id),
                "total_sales": settlement.total_sales,
                "fee_rate": float(settlement.fee_rate),
                "settle_amount": settlement.settle_amount,
                "status": settlement.status,
                "settle_date": settlement.settle_date.isoformat(),
                "created_at": settlement.created_at.isoformat()
            }
            settlement_list.append(settlement_data)
        
        return {
            "settlements": settlement_list,
            "total": total,
            "page": page,
            "page_size": page_size
        }
    
    @staticmethod
    async def get_settlement_detail(
        db: AsyncSession,
        settlement_id: str
    ) -> Dict[str, Any]:
        """
        정산 상세 내역 조회
        
        Args:
            db: 데이터베이스 세션
            settlement_id: 정산 ID
        
        Returns:
            정산 상세 정보
        """
        try:
            settlement_uuid = uuid.UUID(settlement_id)
        except ValueError:
            raise ValueError("유효하지 않은 정산 ID 형식입니다")
        
        result = await db.execute(
            select(Settlement)
            .options(
                selectinload(Settlement.inspector),
                selectinload(Settlement.inspection)
            )
            .where(Settlement.id == settlement_uuid)
        )
        settlement = result.scalar_one_or_none()
        
        if not settlement:
            raise ValueError("정산 내역을 찾을 수 없습니다")
        
        # 정산 데이터
        settlement_data = {
            "id": str(settlement.id),
            "inspector_id": str(settlement.inspector_id),
            "inspector_name": settlement.inspector.name if settlement.inspector else None,
            "inspection_id": str(settlement.inspection_id),
            "total_sales": settlement.total_sales,
            "fee_rate": float(settlement.fee_rate),
            "settle_amount": settlement.settle_amount,
            "status": settlement.status,
            "settle_date": settlement.settle_date.isoformat(),
            "created_at": settlement.created_at.isoformat()
        }
        
        # 진단 상세 정보
        inspection_detail = None
        if settlement.inspection:
            inspection = settlement.inspection
            inspection_detail = {
                "id": str(inspection.id),
                "plate_number": inspection.plate_number,
                "production_year": inspection.production_year,
                "location_address": inspection.location_address,
                "preferred_schedule": inspection.preferred_schedule.isoformat() if inspection.preferred_schedule else None,
                "status": inspection.status,
                "total_amount": inspection.total_amount
            }
        
        # 기사 상세 정보
        inspector_detail = None
        if settlement.inspector:
            inspector = settlement.inspector
            inspector_detail = {
                "id": str(inspector.id),
                "name": inspector.name,
                "phone": inspector.phone,
                "commission_rate": float(inspector.commission_rate) if inspector.commission_rate else None
            }
        
        return {
            "settlement": settlement_data,
            "inspection_detail": inspection_detail,
            "inspector_detail": inspector_detail
        }
    
    @staticmethod
    async def get_settlement_summary(
        db: AsyncSession,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        정산 요약 정보 조회
        
        Args:
            db: 데이터베이스 세션
            start_date: 시작일
            end_date: 종료일
        
        Returns:
            정산 요약 정보
        """
        # 기본 기간 설정 (없으면 최근 30일)
        if not end_date:
            end_date = date.today()
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        # 전체 정산 통계
        query = select(
            Settlement.status,
            func.sum(Settlement.settle_amount).label("total_amount"),
            func.count(Settlement.id).label("count")
        ).where(
            and_(
                Settlement.settle_date >= start_date,
                Settlement.settle_date <= end_date
            )
        ).group_by(Settlement.status)
        
        result = await db.execute(query)
        stats = result.all()
        
        total_pending_amount = 0
        total_completed_amount = 0
        pending_count = 0
        completed_count = 0
        
        for stat in stats:
            if stat.status == "pending":
                total_pending_amount = int(stat.total_amount or 0)
                pending_count = stat.count
            elif stat.status == "completed":
                total_completed_amount = int(stat.total_amount or 0)
                completed_count = stat.count
        
        # 기사별 정산 요약
        inspector_query = select(
            Settlement.inspector_id,
            User.name.label("inspector_name"),
            func.count(Settlement.id).label("inspection_count"),
            func.sum(Settlement.total_sales).label("total_sales"),
            func.sum(Settlement.settle_amount).label("total_settle_amount"),
            func.sum(
                func.case(
                    (Settlement.status == "pending", Settlement.settle_amount),
                    else_=0
                )
            ).label("pending_amount"),
            func.sum(
                func.case(
                    (Settlement.status == "completed", Settlement.settle_amount),
                    else_=0
                )
            ).label("completed_amount")
        ).join(
            User, Settlement.inspector_id == User.id
        ).where(
            and_(
                Settlement.settle_date >= start_date,
                Settlement.settle_date <= end_date
            )
        ).group_by(
            Settlement.inspector_id,
            User.name
        )
        
        inspector_result = await db.execute(inspector_query)
        inspector_summary = []
        for row in inspector_result.all():
            inspector_summary.append({
                "inspector_id": str(row.inspector_id),
                "inspector_name": row.inspector_name,
                "inspection_count": row.inspection_count,
                "total_sales": int(row.total_sales or 0),
                "total_settle_amount": int(row.total_settle_amount or 0),
                "pending_amount": int(row.pending_amount or 0),
                "completed_amount": int(row.completed_amount or 0)
            })
        
        # 일별 정산 요약
        daily_query = select(
            Settlement.settle_date,
            func.sum(Settlement.settle_amount).label("total_amount"),
            func.count(Settlement.id).label("count")
        ).where(
            and_(
                Settlement.settle_date >= start_date,
                Settlement.settle_date <= end_date
            )
        ).group_by(
            Settlement.settle_date
        ).order_by(Settlement.settle_date)
        
        daily_result = await db.execute(daily_query)
        daily_summary = []
        for row in daily_result.all():
            daily_summary.append({
                "date": row.settle_date.isoformat(),
                "total_amount": int(row.total_amount or 0),
                "count": row.count
            })
        
        # 주별 정산 요약 (ISO 주 기준)
        weekly_query = select(
            func.date_trunc('week', Settlement.settle_date).label("week_start"),
            func.sum(Settlement.settle_amount).label("total_amount"),
            func.count(Settlement.id).label("count")
        ).where(
            and_(
                Settlement.settle_date >= start_date,
                Settlement.settle_date <= end_date
            )
        ).group_by(
            func.date_trunc('week', Settlement.settle_date)
        ).order_by(func.date_trunc('week', Settlement.settle_date))
        
        weekly_result = await db.execute(weekly_query)
        weekly_summary = []
        for row in weekly_result.all():
            weekly_summary.append({
                "week_start": row.week_start.isoformat() if row.week_start else None,
                "total_amount": int(row.total_amount or 0),
                "count": row.count
            })
        
        # 월별 정산 요약
        monthly_query = select(
            func.date_trunc('month', Settlement.settle_date).label("month_start"),
            func.sum(Settlement.settle_amount).label("total_amount"),
            func.count(Settlement.id).label("count")
        ).where(
            and_(
                Settlement.settle_date >= start_date,
                Settlement.settle_date <= end_date
            )
        ).group_by(
            func.date_trunc('month', Settlement.settle_date)
        ).order_by(func.date_trunc('month', Settlement.settle_date))
        
        monthly_result = await db.execute(monthly_query)
        monthly_summary = []
        for row in monthly_result.all():
            monthly_summary.append({
                "month_start": row.month_start.isoformat() if row.month_start else None,
                "total_amount": int(row.total_amount or 0),
                "count": row.count
            })
        
        return {
            "total_pending_amount": total_pending_amount,
            "total_completed_amount": total_completed_amount,
            "pending_count": pending_count,
            "completed_count": completed_count,
            "inspector_summary": inspector_summary,
            "daily_summary": daily_summary,
            "weekly_summary": weekly_summary,
            "monthly_summary": monthly_summary
        }
    
    @staticmethod
    async def update_settlement_status(
        db: AsyncSession,
        settlement_id: str,
        status: str
    ) -> Dict[str, Any]:
        """
        정산 상태 변경
        
        Args:
            db: 데이터베이스 세션
            settlement_id: 정산 ID
            status: 새 상태
        
        Returns:
            업데이트된 정산 정보
        """
        if status not in ["pending", "completed"]:
            raise ValueError("유효하지 않은 정산 상태입니다")
        
        try:
            settlement_uuid = uuid.UUID(settlement_id)
        except ValueError:
            raise ValueError("유효하지 않은 정산 ID 형식입니다")
        
        result = await db.execute(
            select(Settlement).where(Settlement.id == settlement_uuid)
        )
        settlement = result.scalar_one_or_none()
        
        if not settlement:
            raise ValueError("정산 내역을 찾을 수 없습니다")
        
        settlement.status = status
        await db.commit()
        await db.refresh(settlement)
        
        return {
            "id": str(settlement.id),
            "status": settlement.status,
            "settle_amount": settlement.settle_amount
        }
    
    @staticmethod
    async def bulk_update_settlement_status(
        db: AsyncSession,
        settlement_ids: List[str],
        status: str
    ) -> Dict[str, Any]:
        """
        정산 일괄 상태 변경
        
        Args:
            db: 데이터베이스 세션
            settlement_ids: 정산 ID 목록
            status: 새 상태
        
        Returns:
            업데이트 결과
        """
        if status not in ["pending", "completed"]:
            raise ValueError("유효하지 않은 정산 상태입니다")
        
        settlement_uuids = []
        for settlement_id in settlement_ids:
            try:
                settlement_uuids.append(uuid.UUID(settlement_id))
            except ValueError:
                raise ValueError(f"유효하지 않은 정산 ID 형식입니다: {settlement_id}")
        
        result = await db.execute(
            select(Settlement).where(Settlement.id.in_(settlement_uuids))
        )
        settlements = result.scalars().all()
        
        updated_count = 0
        for settlement in settlements:
            settlement.status = status
            updated_count += 1
        
        await db.commit()
        
        return {
            "updated_count": updated_count,
            "total_requested": len(settlement_ids),
            "status": status
        }

