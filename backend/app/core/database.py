"""
데이터베이스 연결 및 세션 관리
"""
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base

from app.core.config import settings

# 비동기 엔진 생성
engine = create_async_engine(
    settings.database_url,
    echo=settings.DEBUG,
    future=True
)

# 세션 팩토리 생성
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

# 베이스 모델 클래스
Base = declarative_base()


async def get_db() -> AsyncSession:
    """
    데이터베이스 세션 의존성 주입 함수
    
    Usage:
        @app.get("/users")
        async def get_users(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

