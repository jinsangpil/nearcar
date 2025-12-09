#!/usr/bin/env python3
"""
vehicle_master 테이블의 데이터를 manufacturers와 vehicle_models로 마이그레이션하는 스크립트

사용법:
    python scripts/migrate_vehicle_master_to_separate_tables.py
"""
import asyncio
import sys
from pathlib import Path
from typing import Dict, List, Tuple
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
import uuid

# 프로젝트 루트를 Python 경로에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.config import settings
from app.models.vehicle_master import VehicleMaster


async def migrate_data():
    """vehicle_master 데이터를 manufacturers와 vehicle_models로 마이그레이션"""
    
    # 데이터베이스 엔진 생성
    engine = create_async_engine(
        settings.database_url,
        echo=False,
        future=True
    )
    
    async_session = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False
    )
    
    try:
        async with async_session() as session:
            print("=" * 60)
            print("차량 마스터 데이터 마이그레이션 시작")
            print("=" * 60)
            
            # 1. 마이그레이션 SQL 스크립트 실행
            print("\n1. 테이블 생성 중...")
            migration_sql_path = Path(__file__).parent.parent / "database" / "migrations" / "002_separate_manufacturers_and_vehicle_models.sql"
            
            if not migration_sql_path.exists():
                print(f"❌ 마이그레이션 SQL 파일을 찾을 수 없습니다: {migration_sql_path}")
                return
            
            with open(migration_sql_path, "r", encoding="utf-8") as f:
                migration_sql = f.read()
            
            # SQL 문장을 세미콜론으로 분리하여 실행
            # 주석 제거 및 빈 줄 제거
            lines = migration_sql.split("\n")
            cleaned_lines = []
            for line in lines:
                stripped = line.strip()
                if stripped and not stripped.startswith("--"):
                    cleaned_lines.append(line)
            
            cleaned_sql = "\n".join(cleaned_lines)
            statements = [s.strip() for s in cleaned_sql.split(";") if s.strip()]
            
            for i, statement in enumerate(statements, 1):
                if statement:
                    try:
                        await session.execute(text(statement))
                        await session.commit()
                    except Exception as e:
                        error_msg = str(e).lower()
                        # 테이블/인덱스가 이미 존재하는 경우 무시
                        if "already exists" in error_msg or "duplicate" in error_msg:
                            await session.rollback()
                            continue
                        # 트리거가 이미 존재하는 경우 무시
                        if "trigger" in error_msg and "already exists" in error_msg:
                            await session.rollback()
                            continue
                        # 기타 오류는 출력하고 계속 진행
                        print(f"⚠️ SQL 문장 {i} 실행 중 경고: {str(e)[:100]}")
                        await session.rollback()
            
            print("✅ 테이블 생성 완료")
            
            # 2. 기존 vehicle_master 데이터 조회
            print("\n2. 기존 vehicle_master 데이터 조회 중...")
            result = await session.execute(select(VehicleMaster))
            vehicle_masters = result.scalars().all()
            
            if not vehicle_masters:
                print("⚠️ 마이그레이션할 데이터가 없습니다.")
                return
            
            print(f"✅ {len(vehicle_masters)}개 레코드 발견")
            
            # 3. 제조사 중복 제거 및 manufacturers 생성
            print("\n3. 제조사 데이터 생성 중...")
            manufacturer_map: Dict[Tuple[str, str], uuid.UUID] = {}  # (name, origin) -> id
            
            # 고유한 제조사 목록 추출
            unique_manufacturers = {}
            for vm in vehicle_masters:
                key = (vm.manufacturer, vm.origin)
                if key not in unique_manufacturers:
                    unique_manufacturers[key] = {
                        "name": vm.manufacturer,
                        "origin": vm.origin,
                        "is_active": True
                    }
            
            print(f"   발견된 고유 제조사: {len(unique_manufacturers)}개")
            
            # manufacturers 테이블에 제조사 삽입
            for (name, origin), data in unique_manufacturers.items():
                # 이미 존재하는지 확인
                check_query = text("""
                    SELECT id FROM manufacturers 
                    WHERE name = :name AND origin = :origin
                """)
                result = await session.execute(
                    check_query,
                    {"name": name, "origin": origin}
                )
                existing = result.scalar_one_or_none()
                
                if existing:
                    manufacturer_map[(name, origin)] = existing
                    print(f"   ✓ {name} ({origin}) - 기존 데이터 사용")
                else:
                    # 새 제조사 생성
                    insert_query = text("""
                        INSERT INTO manufacturers (name, origin, is_active)
                        VALUES (:name, :origin, :is_active)
                        RETURNING id
                    """)
                    result = await session.execute(
                        insert_query,
                        {"name": name, "origin": origin, "is_active": True}
                    )
                    new_id = result.scalar_one()
                    manufacturer_map[(name, origin)] = new_id
                    print(f"   ✓ {name} ({origin}) - 새로 생성 (ID: {new_id})")
            
            await session.commit()
            print(f"✅ {len(manufacturer_map)}개 제조사 처리 완료")
            
            # 4. vehicle_models 생성
            print("\n4. 차량 모델 데이터 생성 중...")
            created_count = 0
            updated_count = 0
            skipped_count = 0
            
            for vm in vehicle_masters:
                manufacturer_id = manufacturer_map[(vm.manufacturer, vm.origin)]
                
                # 이미 존재하는지 확인
                check_query = text("""
                    SELECT id FROM vehicle_models 
                    WHERE manufacturer_id = :manufacturer_id 
                    AND model_group = :model_group 
                    AND (model_detail = :model_detail OR (model_detail IS NULL AND :model_detail IS NULL))
                """)
                result = await session.execute(
                    check_query,
                    {
                        "manufacturer_id": manufacturer_id,
                        "model_group": vm.model_group,
                        "model_detail": vm.model_detail
                    }
                )
                existing = result.scalar_one_or_none()
                
                if existing:
                    # 기존 데이터 업데이트
                    update_query = text("""
                        UPDATE vehicle_models
                        SET vehicle_class = :vehicle_class,
                            start_year = :start_year,
                            end_year = :end_year,
                            is_active = :is_active,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = :id
                    """)
                    await session.execute(
                        update_query,
                        {
                            "id": existing,
                            "vehicle_class": vm.vehicle_class,
                            "start_year": vm.start_year,
                            "end_year": vm.end_year,
                            "is_active": vm.is_active
                        }
                    )
                    updated_count += 1
                else:
                    # 새 모델 생성
                    insert_query = text("""
                        INSERT INTO vehicle_models (
                            manufacturer_id, model_group, model_detail,
                            vehicle_class, start_year, end_year, is_active
                        )
                        VALUES (
                            :manufacturer_id, :model_group, :model_detail,
                            :vehicle_class, :start_year, :end_year, :is_active
                        )
                    """)
                    await session.execute(
                        insert_query,
                        {
                            "manufacturer_id": manufacturer_id,
                            "model_group": vm.model_group,
                            "model_detail": vm.model_detail,
                            "vehicle_class": vm.vehicle_class,
                            "start_year": vm.start_year,
                            "end_year": vm.end_year,
                            "is_active": vm.is_active
                        }
                    )
                    created_count += 1
                
                # 진행 상황 출력 (100개마다)
                if (created_count + updated_count) % 100 == 0:
                    print(f"   진행 중... {created_count + updated_count}/{len(vehicle_masters)}")
            
            await session.commit()
            
            print(f"\n✅ 차량 모델 데이터 마이그레이션 완료:")
            print(f"   - 생성: {created_count}건")
            print(f"   - 업데이트: {updated_count}건")
            print(f"   - 총 처리: {created_count + updated_count}건")
            
            # 5. 마이그레이션 결과 검증
            print("\n5. 마이그레이션 결과 검증 중...")
            
            # manufacturers 개수 확인
            result = await session.execute(text("SELECT COUNT(*) FROM manufacturers"))
            manufacturer_count = result.scalar_one()
            print(f"   ✓ manufacturers 테이블: {manufacturer_count}개")
            
            # vehicle_models 개수 확인
            result = await session.execute(text("SELECT COUNT(*) FROM vehicle_models"))
            model_count = result.scalar_one()
            print(f"   ✓ vehicle_models 테이블: {model_count}개")
            
            # vehicle_master 개수 확인
            result = await session.execute(text("SELECT COUNT(*) FROM vehicle_master"))
            original_count = result.scalar_one()
            print(f"   ✓ vehicle_master 테이블 (원본): {original_count}개")
            
            if model_count == original_count:
                print("\n✅ 마이그레이션 검증 성공: 모든 데이터가 정상적으로 마이그레이션되었습니다.")
            else:
                print(f"\n⚠️ 마이그레이션 검증 경고: 원본 {original_count}개 vs 마이그레이션 {model_count}개")
            
            print("\n" + "=" * 60)
            print("마이그레이션 완료!")
            print("=" * 60)
            
    except Exception as e:
        print(f"\n❌ 마이그레이션 중 오류 발생: {str(e)}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(migrate_data())

