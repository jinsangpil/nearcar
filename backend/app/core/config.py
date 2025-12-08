"""
애플리케이션 설정 관리 모듈
환경 변수를 읽어서 애플리케이션 설정을 구성합니다.
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """애플리케이션 설정"""
    
    # 애플리케이션 기본 설정
    APP_NAME: str = "NearCar API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"
    
    # 데이터베이스 설정
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "nearcar_db"
    DB_USER: str = "postgres"
    DB_PASSWORD: str = ""
    DATABASE_URL: Optional[str] = None
    
    @property
    def database_url(self) -> str:
        """데이터베이스 연결 URL 생성"""
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    
    # JWT 설정
    JWT_SECRET_KEY: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 120  # 2시간
    JWT_GUEST_TOKEN_EXPIRE_MINUTES: int = 30  # 30분 (비회원)
    
    # 암호화 설정
    ENCRYPTION_KEY: str = "your-32-byte-encryption-key-change-in-production"
    
    # Redis 설정
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: Optional[str] = None
    REDIS_DB: int = 0
    
    @property
    def redis_url(self) -> str:
        """Redis 연결 URL 생성"""
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
    
    # CORS 설정
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:3001"]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: list[str] = ["*"]
    CORS_ALLOW_HEADERS: list[str] = ["*"]
    
    # 쿠키 설정
    COOKIE_SECURE: bool = False  # 개발 환경에서는 False, 프로덕션에서는 True
    COOKIE_HTTP_ONLY: bool = True
    COOKIE_SAME_SITE: str = "lax"
    
    # 토스페이먼츠 설정
    TOSS_CLIENT_KEY: str = ""
    TOSS_SECRET_KEY: str = ""
    TOSS_API_URL: str = "https://api.tosspayments.com/v1"  # 프로덕션
    TOSS_TEST_API_URL: str = "https://api.tosspayments.com/v1"  # 테스트/프로덕션 동일
    FRONTEND_URL: str = "http://localhost:3000"  # 프론트엔드 URL
    
    @property
    def toss_api_url(self) -> str:
        """토스페이먼츠 API URL 반환"""
        if self.ENVIRONMENT == "production":
            return self.TOSS_API_URL
        return self.TOSS_TEST_API_URL
    
    # AWS S3 설정 (선택적)
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "ap-northeast-2"
    AWS_S3_BUCKET: str = "nearcar-uploads"
    
    # 알리고 알림 서비스 설정 (SMS 및 알림톡)
    ALIGO_API_KEY: Optional[str] = None  # 알리고 API Key
    ALIGO_USER_ID: Optional[str] = None  # 알리고 사용자 ID
    ALIGO_SENDER: Optional[str] = None  # 발신번호 (사전 등록 필요)
    ALIGO_TEST_MODE: bool = False  # 테스트 모드 (testmode_yn)
    
    # AWS SES 설정 (이메일용)
    AWS_SES_REGION: str = "ap-northeast-2"
    
    # Slack 웹훅 URL (선택적)
    SLACK_WEBHOOK_URL: Optional[str] = None
    
    class Config:
        env_file = [".env.local", ".env"]
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"  # 정의되지 않은 필드 무시


# 전역 설정 인스턴스
settings = Settings()

