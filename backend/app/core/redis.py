"""
Redis 연결 및 유틸리티 함수
"""
from typing import Optional
import redis.asyncio as aioredis
from redis.asyncio import Redis

from app.core.config import settings

# 전역 Redis 연결 풀
redis_pool: Optional[Redis] = None


async def get_redis() -> Redis:
    """
    Redis 연결 가져오기
    
    연결 풀이 없으면 생성하고, 있으면 기존 연결을 반환합니다.
    """
    global redis_pool
    
    if redis_pool is None:
        redis_pool = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True
        )
    
    return redis_pool


async def close_redis():
    """Redis 연결 종료"""
    global redis_pool
    
    if redis_pool:
        await redis_pool.close()
        redis_pool = None


async def set_guest_auth(phone: str, token: str, ttl: int = 1800) -> bool:
    """
    비회원 인증 상태를 Redis에 저장
    
    Args:
        phone: 휴대폰 번호
        token: 발급된 토큰
        ttl: 만료 시간 (초 단위, 기본값: 1800초 = 30분)
    
    Returns:
        저장 성공 여부
    """
    try:
        redis = await get_redis()
        key = f"auth:guest:{phone}"
        await redis.setex(key, ttl, token)
        return True
    except Exception as e:
        # 로깅 추가 필요
        print(f"Redis 저장 실패: {e}")
        return False


async def get_guest_auth(phone: str) -> Optional[str]:
    """
    비회원 인증 상태를 Redis에서 조회
    
    Args:
        phone: 휴대폰 번호
    
    Returns:
        저장된 토큰 (없으면 None)
    """
    try:
        redis = await get_redis()
        key = f"auth:guest:{phone}"
        token = await redis.get(key)
        return token
    except Exception as e:
        # 로깅 추가 필요
        print(f"Redis 조회 실패: {e}")
        return None


async def delete_guest_auth(phone: str) -> bool:
    """
    비회원 인증 상태를 Redis에서 삭제
    
    Args:
        phone: 휴대폰 번호
    
    Returns:
        삭제 성공 여부
    """
    try:
        redis = await get_redis()
        key = f"auth:guest:{phone}"
        await redis.delete(key)
        return True
    except Exception as e:
        # 로깅 추가 필요
        print(f"Redis 삭제 실패: {e}")
        return False


async def check_guest_auth(phone: str, token: str) -> bool:
    """
    비회원 인증 상태 확인
    
    Args:
        phone: 휴대폰 번호
        token: 확인할 토큰
    
    Returns:
        인증 상태 일치 여부
    """
    stored_token = await get_guest_auth(phone)
    return stored_token == token

