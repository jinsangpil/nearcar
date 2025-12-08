"""
보안 미들웨어
- 요청 로깅
- Rate Limiting
- 민감 정보 마스킹
"""
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from typing import Callable
import time
import json
import re
from loguru import logger
from app.core.redis import get_redis


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """요청 로깅 미들웨어"""
    
    SENSITIVE_FIELDS = ['password', 'password_hash', 'phone', 'access_token', 'authorization']
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """요청 로깅 처리"""
        start_time = time.time()
        
        # 요청 정보 수집
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "unknown")
        method = request.method
        path = request.url.path
        query_params = dict(request.query_params)
        
        # 요청 본문 읽기 (민감 정보 마스킹)
        body = None
        if request.method in ["POST", "PUT", "PATCH"]:
            try:
                body_bytes = await request.body()
                if body_bytes:
                    body_str = body_bytes.decode('utf-8')
                    try:
                        body = json.loads(body_str)
                        # 민감 정보 마스킹
                        body = self._mask_sensitive_data(body)
                    except json.JSONDecodeError:
                        body = "[Non-JSON body]"
            except Exception:
                body = "[Unable to read body]"
        
        # 요청 로깅
        logger.info(
            f"Request: {method} {path} | "
            f"IP: {client_ip} | "
            f"User-Agent: {user_agent[:100]} | "
            f"Query: {query_params} | "
            f"Body: {json.dumps(body) if body else 'None'}"
        )
        
        # 요청 처리
        response = await call_next(request)
        
        # 응답 시간 계산
        process_time = time.time() - start_time
        
        # 응답 로깅
        logger.info(
            f"Response: {method} {path} | "
            f"Status: {response.status_code} | "
            f"Time: {process_time:.3f}s"
        )
        
        return response
    
    def _mask_sensitive_data(self, data: dict) -> dict:
        """민감 정보 마스킹"""
        if not isinstance(data, dict):
            return data
        
        masked_data = {}
        for key, value in data.items():
            # 키 이름이 민감 필드인 경우 마스킹
            if any(sensitive in key.lower() for sensitive in self.SENSITIVE_FIELDS):
                masked_data[key] = "***MASKED***"
            elif isinstance(value, dict):
                masked_data[key] = self._mask_sensitive_data(value)
            elif isinstance(value, list):
                masked_data[key] = [
                    self._mask_sensitive_data(item) if isinstance(item, dict) else item
                    for item in value
                ]
            else:
                masked_data[key] = value
        
        return masked_data


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate Limiting 미들웨어"""
    
    def __init__(self, app, calls: int = 100, period: int = 60):
        """
        Args:
            app: FastAPI 앱
            calls: 허용할 요청 수
            period: 시간 범위 (초)
        """
        super().__init__(app)
        self.calls = calls
        self.period = period
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Rate Limiting 처리"""
        # 헬스 체크 및 정적 파일은 제외
        if request.url.path in ["/health", "/"]:
            return await call_next(request)
        
        # 클라이언트 IP 추출
        client_ip = request.client.host if request.client else "unknown"
        
        # Redis에서 Rate Limit 확인
        try:
            redis = await get_redis()
            key = f"rate_limit:{client_ip}"
            
            # 현재 요청 수 확인
            current = await redis.get(key)
            
            if current:
                current = int(current)
                if current >= self.calls:
                    logger.warning(f"Rate limit exceeded for IP: {client_ip}")
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail=f"요청 한도를 초과했습니다. {self.period}초 후 다시 시도해주세요.",
                        headers={"Retry-After": str(self.period)}
                    )
                else:
                    # 요청 수 증가
                    await redis.incr(key)
            else:
                # 첫 요청이면 키 생성 및 만료 시간 설정
                await redis.setex(key, self.period, 1)
            
        except Exception as e:
            # Redis 오류 시 로깅만 하고 계속 진행
            logger.error(f"Rate limit check failed: {e}")
        
        # 요청 처리
        response = await call_next(request)
        return response

