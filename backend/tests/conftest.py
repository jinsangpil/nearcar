"""
pytest 설정 및 공통 fixtures
"""
import pytest
import asyncio
from typing import AsyncGenerator, Generator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy import event
from sqlalchemy.dialects.postgresql import JSONB, UUID as PostgresUUID
from sqlalchemy import ARRAY as SQLAlchemyARRAY
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON
from sqlalchemy.types import TypeDecorator, String
import uuid
from httpx import AsyncClient
from unittest.mock import AsyncMock, MagicMock, patch

from app.core.database import Base, get_db
from app.core.config import settings
from app.main import app
from app.models.user import User
from app.core.security import create_access_token, get_password_hash
import uuid


# 테스트용 데이터베이스 URL (SQLite in-memory)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# 테스트용 엔진 생성
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False
)

# SQLite에서 JSONB를 JSON으로 변환하는 이벤트 리스너
@event.listens_for(test_engine.sync_engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    """SQLite 연결 시 JSON 지원 활성화"""
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

# 이벤트 리스너는 제거하고 직접 변환 함수 사용

# 테스트용 세션 팩토리
TestSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)


@pytest.fixture(scope="session")
def event_loop():
    """이벤트 루프 생성"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


def _convert_jsonb_to_json():
    """JSONB와 ARRAY를 JSON으로 변환 (SQLite 호환)"""
    # 메타데이터의 모든 테이블을 순회하며 JSONB와 ARRAY를 JSON으로 변환
    for table_name, table in Base.metadata.tables.items():
        for column in table.columns:
            if isinstance(column.type, (JSONB, ARRAY)):
                column.type = SQLiteJSON()


# SQLite UUID 호환을 위한 커스텀 타입
class SQLiteUUID(TypeDecorator):
    """SQLite에서 UUID를 문자열로 저장하는 타입"""
    impl = String
    cache_ok = True
    
    def process_bind_param(self, value, dialect):
        if value is not None:
            if isinstance(value, uuid.UUID):
                return str(value)
            return str(value)
        return value
    
    def process_result_value(self, value, dialect):
        if value is not None:
            return uuid.UUID(value)
        return value

def _create_tables_with_sqlite_compat(bind):
    """SQLite 호환성을 위해 타입 변환 후 테이블 생성"""
    # JSONB, ARRAY, UUID를 SQLite 호환 타입으로 변환
    for table_name, table in Base.metadata.tables.items():
        for column in table.columns:
            # JSONB 타입 확인
            if isinstance(column.type, JSONB):
                column.type = SQLiteJSON()
            # ARRAY 타입 확인 (타입 이름으로 확인)
            elif 'ARRAY' in str(type(column.type)):
                column.type = SQLiteJSON()
            # UUID 타입 확인 (PostgreSQL UUID를 SQLiteUUID로 변환)
            elif isinstance(column.type, PostgresUUID):
                column.type = SQLiteUUID()
    
    # 테이블 생성
    Base.metadata.create_all(bind)


@pytest.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    테스트용 데이터베이스 세션 생성
    
    각 테스트마다 새로운 트랜잭션을 시작하고,
    테스트 종료 시 롤백하여 데이터를 정리합니다.
    """
    # 테이블 생성 (SQLite 호환 타입 변환 포함)
    async with test_engine.begin() as conn:
        await conn.run_sync(_create_tables_with_sqlite_compat)
    
    # 세션 생성
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()
    
    # 테이블 삭제
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """
    테스트용 FastAPI 클라이언트 생성
    
    데이터베이스 의존성을 테스트용 세션으로 오버라이드합니다.
    """
    async def override_get_db():
        yield db_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    
    app.dependency_overrides.clear()


@pytest.fixture
async def test_user(db_session: AsyncSession) -> User:
    """
    테스트용 사용자 생성

    Returns:
        생성된 User 객체
    """
    from app.core.security import encrypt_phone
    # passlib의 bcrypt 초기화 문제를 우회하기 위해 간단한 해시 사용
    # 실제 프로덕션에서는 get_password_hash를 사용하지만, 테스트에서는 모킹
    # 테스트에서 verify_password를 모킹하여 검증합니다
    user = User(
        id=uuid.uuid4(),
        email="test@example.com",
        password_hash="$2b$12$test_hash_for_testing_purposes_only",  # 테스트용 더미 해시
        name="테스트 사용자",
        phone=encrypt_phone("01012345678"),
        role="user",
        status="active"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def test_admin_user(db_session: AsyncSession) -> User:
    """
    테스트용 관리자 사용자 생성

    Returns:
        생성된 관리자 User 객체
    """
    from app.core.security import encrypt_phone
    # passlib의 bcrypt 초기화 문제를 우회하기 위해 간단한 해시 사용
    admin = User(
        id=uuid.uuid4(),
        email="admin@example.com",
        password_hash="$2b$12$test_hash_for_testing_purposes_only",  # 테스트용 더미 해시
        name="관리자",
        phone=encrypt_phone("01087654321"),
        role="admin",
        status="active"
    )
    db_session.add(admin)
    await db_session.commit()
    await db_session.refresh(admin)
    return admin


@pytest.fixture
async def test_inspector_user(db_session: AsyncSession) -> User:
    """
    테스트용 기사 사용자 생성

    Returns:
        생성된 기사 User 객체
    """
    from app.core.security import encrypt_phone
    # passlib의 bcrypt 초기화 문제를 우회하기 위해 간단한 해시 사용
    inspector = User(
        id=uuid.uuid4(),
        email="inspector@example.com",
        password_hash="$2b$12$test_hash_for_testing_purposes_only",  # 테스트용 더미 해시
        name="기사",
        phone=encrypt_phone("01011112222"),
        role="inspector",
        status="active"
    )
    db_session.add(inspector)
    await db_session.commit()
    await db_session.refresh(inspector)
    return inspector


@pytest.fixture
def auth_token(test_user: User) -> str:
    """
    테스트용 JWT 토큰 생성
    
    Args:
        test_user: 테스트 사용자 객체
    
    Returns:
        JWT 토큰 문자열
    """
    return create_access_token(data={"sub": str(test_user.id), "role": test_user.role})


@pytest.fixture
def admin_token(test_admin_user: User) -> str:
    """
    테스트용 관리자 JWT 토큰 생성
    
    Args:
        test_admin_user: 테스트 관리자 사용자 객체
    
    Returns:
        관리자 JWT 토큰 문자열
    """
    return create_access_token(data={"sub": str(test_admin_user.id), "role": test_admin_user.role})


@pytest.fixture
def inspector_token(test_inspector_user: User) -> str:
    """
    테스트용 기사 JWT 토큰 생성
    
    Args:
        test_inspector_user: 테스트 기사 사용자 객체
    
    Returns:
        기사 JWT 토큰 문자열
    """
    return create_access_token(data={"sub": str(test_inspector_user.id), "role": test_inspector_user.role})


@pytest.fixture
def mock_redis():
    """
    Redis 모킹 fixture
    
    Returns:
        모킹된 Redis 클라이언트
    """
    mock_redis_client = AsyncMock()
    mock_redis_client.get.return_value = None
    mock_redis_client.set.return_value = True
    mock_redis_client.delete.return_value = True
    return mock_redis_client


@pytest.fixture
def mock_s3_client():
    """
    AWS S3 클라이언트 모킹 fixture
    
    Returns:
        모킹된 boto3 S3 클라이언트
    """
    mock_client = MagicMock()
    mock_client.generate_presigned_post.return_value = {
        "url": "https://s3.amazonaws.com/test-bucket/",
        "fields": {"key": "test-key"}
    }
    mock_client.put_object.return_value = {"ETag": "test-etag"}
    return mock_client


@pytest.fixture
def mock_toss_payment_service():
    """
    토스페이먼츠 서비스 모킹 fixture
    
    Returns:
        모킹된 TossPaymentService
    """
    mock_service = MagicMock()
    mock_service.request_payment.return_value = {
        "payment_key": "test_payment_key",
        "order_id": "test_order_id",
        "checkout_url": "https://checkout.tosspayments.com/test"
    }
    mock_service.confirm_payment.return_value = {
        "transactionKey": "test_transaction_key",
        "method": "card",
        "status": "DONE"
    }
    return mock_service


@pytest.fixture
def mock_channel_service():
    """
    채널 서비스 모킹 fixture (알림 발송용)
    
    Returns:
        모킹된 ChannelService
    """
    mock_service = AsyncMock()
    mock_service.send_alimtalk.return_value = {
        "success": True,
        "channel": "alimtalk",
        "message_id": "test_msg_id"
    }
    mock_service.send_sms.return_value = {
        "success": True,
        "channel": "sms",
        "message_id": "test_msg_id"
    }
    mock_service.send_email.return_value = {
        "success": True,
        "channel": "email",
        "message_id": "test_msg_id"
    }
    return mock_service

