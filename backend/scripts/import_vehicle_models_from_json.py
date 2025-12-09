#!/usr/bin/env python3
"""
JSON 파일에서 vehicle_models 데이터를 가져와서 데이터베이스에 저장하는 스크립트
JSON의 manufacturer 값과 manufacturers 테이블의 name을 매칭하여 manufacturer_id를 찾습니다.
"""
import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select, text
from dotenv import load_dotenv

# .env.local 파일 로드
load_dotenv(Path(__file__).parent.parent / ".env.local")

# 환경 변수에서 DB 설정 가져오기
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "nearcar_db")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

DATABASE_URL = f"postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, autocommit=False, autoflush=False)


async def get_manufacturer_map(db: AsyncSession) -> Dict[tuple, str]:
    """
    manufacturers 테이블에서 (name, origin) -> id 매핑을 생성합니다.
    
    Returns:
        {(name, origin): id} 형태의 딕셔너리
    """
    result = await db.execute(
        select(text("id, name, origin")).select_from(text("manufacturers"))
    )
    rows = result.all()
    
    manufacturer_map = {}
    for row in rows:
        key = (row.name, row.origin)
        manufacturer_map[key] = str(row.id)
        print(f"  제조사 매핑: {row.name} ({row.origin}) -> {row.id}")
    
    return manufacturer_map


async def import_vehicle_models_from_json(json_file_path: str):
    """
    JSON 파일에서 vehicle_models 데이터를 읽어서 데이터베이스에 저장합니다.
    
    Args:
        json_file_path: JSON 파일 경로
    """
    print("=" * 60)
    print("JSON 파일에서 차량 모델 데이터 가져오기")
    print("=" * 60)
    print()
    
    # JSON 파일 읽기
    print(f"📖 JSON 파일 읽기: {json_file_path}")
    with open(json_file_path, "r", encoding="utf-8") as f:
        vehicles = json.load(f)
    
    print(f"✅ {len(vehicles)}개 차량 데이터 로드 완료")
    print()
    
    async with AsyncSessionLocal() as session:
        # 제조사 매핑 가져오기
        print("📦 제조사 매핑 정보 가져오기...")
        manufacturer_map = await get_manufacturer_map(session)
        print(f"✅ {len(manufacturer_map)}개 제조사 매핑 완료")
        print()
        
        # vehicle_models 데이터 준비
        print("📝 차량 모델 데이터 준비 중...")
        vehicle_models_data = []
        missing_manufacturers = set()
        
        for vehicle in vehicles:
            manufacturer_name = vehicle.get("manufacturer", "").strip()
            origin = vehicle.get("origin", "").strip()
            
            # 제조사 ID 찾기
            manufacturer_key = (manufacturer_name, origin)
            manufacturer_id = manufacturer_map.get(manufacturer_key)
            
            if not manufacturer_id:
                missing_manufacturers.add(f"{manufacturer_name} ({origin})")
                print(f"  ⚠️ 제조사를 찾을 수 없음: {manufacturer_name} ({origin})")
                continue
            
            vehicle_models_data.append({
                "manufacturer_id": manufacturer_id,
                "model_group": vehicle.get("model_group", "").strip(),
                "model_detail": vehicle.get("model_detail") if vehicle.get("model_detail") else None,
                "vehicle_class": vehicle.get("vehicle_class", "mid").strip(),
                "start_year": vehicle.get("start_year", 2000),
                "end_year": vehicle.get("end_year"),
                "is_active": vehicle.get("is_active", True),
            })
        
        if missing_manufacturers:
            print()
            print(f"⚠️ 경고: {len(missing_manufacturers)}개 제조사를 찾을 수 없습니다:")
            for mfr in sorted(missing_manufacturers):
                print(f"   - {mfr}")
            print()
        
        print(f"✅ {len(vehicle_models_data)}개 차량 모델 데이터 준비 완료")
        print()
        
        # 데이터베이스에 저장
        print("💾 데이터베이스에 저장 중...")
        
        # 기존 데이터 확인
        result = await session.execute(text("SELECT COUNT(*) FROM vehicle_models"))
        existing_count = result.scalar_one()
        print(f"   기존 차량 모델: {existing_count}건")
        
        if existing_count > 0:
            print("   ⚠️ 기존 데이터가 있습니다. 삭제 후 새로 저장합니다.")
            await session.execute(text("DELETE FROM vehicle_models"))
            await session.commit()
        
        # 일괄 삽입
        inserted_count = 0
        for vm_data in vehicle_models_data:
            try:
                await session.execute(
                    text("""
                        INSERT INTO vehicle_models 
                        (manufacturer_id, model_group, model_detail, vehicle_class, start_year, end_year, is_active, created_at, updated_at)
                        VALUES 
                        (:manufacturer_id, :model_group, :model_detail, :vehicle_class, :start_year, :end_year, :is_active, NOW(), NOW())
                    """),
                    {
                        "manufacturer_id": vm_data["manufacturer_id"],
                        "model_group": vm_data["model_group"],
                        "model_detail": vm_data["model_detail"],
                        "vehicle_class": vm_data["vehicle_class"],
                        "start_year": vm_data["start_year"],
                        "end_year": vm_data["end_year"],
                        "is_active": vm_data["is_active"],
                    }
                )
                inserted_count += 1
            except Exception as e:
                print(f"   ❌ 오류 발생 ({vm_data['model_group']} {vm_data.get('model_detail', '')}): {str(e)}")
        
        await session.commit()
        
        # 저장 후 확인
        result = await session.execute(text("SELECT COUNT(*) FROM vehicle_models"))
        final_count = result.scalar_one()
        
        print()
        print("=" * 60)
        print("✅ 저장 완료!")
        print("=" * 60)
        print(f"   - 저장된 차량 모델: {inserted_count}건")
        print(f"   - 데이터베이스 총 개수: {final_count}건")
        print()
        
        # 제조사별 통계
        print("📊 제조사별 통계:")
        result = await session.execute(
            text("""
                SELECT m.name, m.origin, COUNT(vm.id) as count
                FROM vehicle_models vm
                JOIN manufacturers m ON vm.manufacturer_id = m.id
                GROUP BY m.name, m.origin
                ORDER BY m.origin, m.name
            """)
        )
        rows = result.all()
        for row in rows:
            print(f"   - {row.name} ({row.origin}): {row.count}건")


async def main():
    """메인 함수"""
    # JSON 파일 경로
    script_dir = Path(__file__).parent
    json_file_path = script_dir / "kcar_vehicles.json"
    
    if not json_file_path.exists():
        print(f"❌ JSON 파일을 찾을 수 없습니다: {json_file_path}")
        sys.exit(1)
    
    try:
        await import_vehicle_models_from_json(str(json_file_path))
    except Exception as e:
        print(f"❌ 오류 발생: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())

