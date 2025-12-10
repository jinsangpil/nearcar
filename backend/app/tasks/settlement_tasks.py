"""
정산 집계 Celery Tasks
"""
from celery import Task
from typing import Dict, Any
from datetime import date, datetime, timedelta
from loguru import logger

import asyncio
from app.core.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.services.admin_service import AdminService


class SettlementCalculationTask(Task):
    """정산 집계 Task 기본 클래스"""
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Task 실패 시 호출"""
        logger.error(f"정산 집계 Task 실패: {task_id}, 오류: {exc}")
        super().on_failure(exc, task_id, args, kwargs, einfo)
    
    def on_success(self, retval, task_id, args, kwargs):
        """Task 성공 시 호출"""
        logger.info(f"정산 집계 Task 성공: {task_id}, 결과: {retval}")
        super().on_success(retval, task_id, args, kwargs)


@celery_app.task(
    bind=True,
    base=SettlementCalculationTask,
    name="calculate_settlements_for_date",
    max_retries=3,
    default_retry_delay=300  # 5분
)
def calculate_settlements_for_date(
    self,
    target_date_str: str
) -> Dict[str, Any]:
    """
    특정 날짜에 대한 정산 집계 Task
    
    Args:
        target_date_str: 정산 기준일 (YYYY-MM-DD 형식)
    
    Returns:
        정산 집계 결과
    """
    try:
        # 날짜 문자열을 date 객체로 변환
        target_date = datetime.strptime(target_date_str, '%Y-%m-%d').date()
        
        logger.info(f"정산 집계 시작: target_date={target_date_str}")
        
        # 비동기 함수를 동기적으로 실행
        async def run_calculation():
            async with AsyncSessionLocal() as db:
                try:
                    result = await AdminService.calculate_settlements(
                        db=db,
                        target_date=target_date
                    )
                    return result
                except Exception as e:
                    logger.error(f"정산 집계 중 오류 발생: {str(e)}")
                    raise
        
        result = asyncio.run(run_calculation())
        
        logger.info(
            f"정산 집계 완료: target_date={target_date_str}, "
            f"settlements_created={result.get('settlements_created', 0)}, "
            f"total_inspections={result.get('total_inspections', 0)}"
        )
        
        return {
            "success": True,
            "target_date": target_date_str,
            "settlements_created": result.get("settlements_created", 0),
            "total_inspections": result.get("total_inspections", 0),
            "calculated_at": datetime.now().isoformat()
        }
        
    except ValueError as e:
        logger.error(f"정산 집계 실패 (잘못된 날짜 형식): {target_date_str}, 오류: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"정산 집계 실패: target_date={target_date_str}, 오류: {str(e)}")
        # 재시도
        raise self.retry(exc=e, countdown=300)


@celery_app.task(
    bind=True,
    base=SettlementCalculationTask,
    name="calculate_settlements_daily",
    max_retries=3,
    default_retry_delay=300  # 5분
)
def calculate_settlements_daily(self) -> Dict[str, Any]:
    """
    매일 자동으로 전날 정산 집계를 실행하는 Task
    
    Celery Beat에 의해 매일 자정에 실행됩니다.
    전날(어제) 날짜에 완료된 진단 건에 대한 정산을 집계합니다.
    
    Returns:
        정산 집계 결과
    """
    try:
        # 어제 날짜 계산
        yesterday = date.today() - timedelta(days=1)
        target_date_str = yesterday.strftime('%Y-%m-%d')
        
        logger.info(f"일일 정산 집계 시작: target_date={target_date_str}")
        
        # calculate_settlements_for_date Task 호출
        result = calculate_settlements_for_date.apply(args=[target_date_str])
        
        logger.info(f"일일 정산 집계 완료: {result.result}")
        
        return result.result
        
    except Exception as e:
        logger.error(f"일일 정산 집계 실패: 오류: {str(e)}")
        # 재시도
        raise self.retry(exc=e, countdown=300)

