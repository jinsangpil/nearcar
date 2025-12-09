"""
FastAPI 애플리케이션 진입점
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.redis import get_redis, close_redis
from app.core.middleware import RequestLoggingMiddleware, RateLimitMiddleware
from app.api.v1 import auth, users, vehicles, quotes, packages, regions, payments, client, inspector, admin, checklists, notifications, uploads, templates, reports, public_data


@asynccontextmanager
async def lifespan(app: FastAPI):
    """애플리케이션 생명주기 관리"""
    # 시작 시 Redis 연결 초기화
    await get_redis()
    yield
    # 종료 시 Redis 연결 종료
    await close_redis()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
    lifespan=lifespan
)

# CORS 미들웨어 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=settings.CORS_ALLOW_METHODS,
    allow_headers=settings.CORS_ALLOW_HEADERS,
)

# Rate Limiting 미들웨어 (분당 100회 제한)
app.add_middleware(
    RateLimitMiddleware,
    calls=100,
    period=60
)

# 요청 로깅 미들웨어
app.add_middleware(RequestLoggingMiddleware)

# 라우터 등록
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(vehicles.router, prefix="/api/v1")
app.include_router(quotes.router, prefix="/api/v1")
app.include_router(packages.router, prefix="/api/v1")
app.include_router(regions.router, prefix="/api/v1")
app.include_router(payments.router, prefix="/api/v1")
app.include_router(client.router, prefix="/api/v1")
app.include_router(inspector.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(checklists.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(uploads.router, prefix="/api/v1")
app.include_router(templates.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(public_data.router, prefix="/api/v1")


@app.get("/")
async def root():
    """루트 엔드포인트"""
    return {
        "message": "NearCar API",
        "version": settings.APP_VERSION
    }


@app.get("/health")
async def health_check():
    """헬스 체크 엔드포인트"""
    return {"status": "healthy"}

