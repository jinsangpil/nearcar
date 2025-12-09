#!/usr/bin/env python3
"""
차량 모델 데이터 초기화 스크립트
기존 vehicle_models 테이블의 모든 데이터를 삭제합니다 (제조사는 유지)
"""
import asyncio
import os
import sys
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import text
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


async def clear_vehicle_models():
    """
    vehicle_models 테이블의 모든 데이터를 삭제합니다
    """
    print("============================================================")
    print("차량 모델 데이터 초기화")
    print("============================================================")

    async with AsyncSessionLocal() as session:
        try:
            # 기존 차량 모델 개수 확인
            result = await session.execute(text("SELECT COUNT(*) FROM vehicle_models"))
            count = result.scalar_one()
            print(f"\n현재 차량 모델 데이터: {count}건")
            
            if count == 0:
                print("✅ 삭제할 데이터가 없습니다.")
                return
            
            # 확인 메시지
            print(f"\n⚠️  경고: {count}건의 차량 모델 데이터를 삭제합니다.")
            print("제조사 데이터는 유지됩니다.")
            
            # 차량 모델 삭제
            await session.execute(text("DELETE FROM vehicle_models"))
            await session.commit()
            
            # 삭제 후 개수 확인
            result = await session.execute(text("SELECT COUNT(*) FROM vehicle_models"))
            new_count = result.scalar_one()
            
            print(f"\n✅ 차량 모델 데이터 삭제 완료")
            print(f"   - 삭제 전: {count}건")
            print(f"   - 삭제 후: {new_count}건")
            
        except Exception as e:
            await session.rollback()
            print(f"❌ 삭제 중 오류 발생: {e}")
            raise
        finally:
            await session.close()

    print("\n============================================================")
    print("초기화 완료!")
    print("============================================================")


if __name__ == "__main__":
    asyncio.run(clear_vehicle_models())

