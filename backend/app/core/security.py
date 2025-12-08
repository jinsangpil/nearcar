"""
보안 관련 유틸리티 함수
- 비밀번호 해싱/검증
- JWT 토큰 생성/검증
- 암호화/복호화
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from cryptography.fernet import Fernet
import base64
import hashlib

from app.core.config import settings

# 비밀번호 해싱 컨텍스트
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """비밀번호 검증"""
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        # bcrypt 버전 호환성 문제로 직접 bcrypt 사용
        try:
            import bcrypt
            password_bytes = plain_password.encode('utf-8')
            if len(password_bytes) > 72:
                password_bytes = password_bytes[:72]
            return bcrypt.checkpw(password_bytes, hashed_password.encode('utf-8'))
        except Exception:
            return False


def get_password_hash(password: str) -> str:
    """비밀번호 해싱"""
    # bcrypt의 72바이트 제한을 초과하는 비밀번호를 처리
    if len(password.encode('utf-8')) > 72:
        import logging
        logger = logging.getLogger(__name__)
        logger.warning("Password exceeds 72 bytes, truncating for bcrypt.")
        password = password.encode('utf-8')[:72].decode('utf-8', errors='ignore')
    return pwd_context.hash(password)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    JWT 액세스 토큰 생성
    
    Args:
        data: 토큰에 포함할 데이터 (예: {"sub": user_id, "role": "client"})
        expires_delta: 만료 시간 (None이면 기본값 사용)
    
    Returns:
        생성된 JWT 토큰 문자열
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )
    
    return encoded_jwt


def create_guest_token(phone: str, expires_delta: Optional[timedelta] = None) -> str:
    """
    비회원용 임시 토큰 생성
    
    Args:
        phone: 휴대폰 번호
        expires_delta: 만료 시간 (None이면 기본값 사용)
    
    Returns:
        생성된 JWT 토큰 문자열
    """
    data = {
        "sub": phone,
        "role": "guest",
        "type": "guest"
    }
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.JWT_GUEST_TOKEN_EXPIRE_MINUTES)
    
    data.update({"exp": expire, "iat": datetime.utcnow()})
    
    encoded_jwt = jwt.encode(
        data,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )
    
    return encoded_jwt


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """
    JWT 토큰 디코딩 및 검증
    
    Args:
        token: JWT 토큰 문자열
    
    Returns:
        토큰 페이로드 (검증 실패 시 None)
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError:
        return None


def encrypt_phone(phone: str) -> str:
    """
    전화번호 암호화 (AES-256)
    
    Args:
        phone: 평문 전화번호
    
    Returns:
        암호화된 전화번호
    """
    # 32바이트 키 생성 (ENCRYPTION_KEY를 기반으로)
    key = hashlib.sha256(settings.ENCRYPTION_KEY.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(key)
    fernet = Fernet(fernet_key)
    
    encrypted = fernet.encrypt(phone.encode())
    return encrypted.decode()


def decrypt_phone(encrypted_phone: str) -> str:
    """
    전화번호 복호화
    
    Args:
        encrypted_phone: 암호화된 전화번호
    
    Returns:
        복호화된 전화번호
    """
    # 32바이트 키 생성 (ENCRYPTION_KEY를 기반으로)
    key = hashlib.sha256(settings.ENCRYPTION_KEY.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(key)
    fernet = Fernet(fernet_key)
    
    decrypted = fernet.decrypt(encrypted_phone.encode())
    return decrypted.decode()

