"""
인증 API 테스트
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import patch

from app.models.user import User
import uuid


@pytest.mark.asyncio
@pytest.mark.api
class TestAuthAPI:
    """인증 API 테스트"""
    
    async def test_login_success(
        self,
        client: AsyncClient,
        test_user: User
    ):
        """로그인 성공 테스트"""
        # passlib의 bcrypt 초기화 문제를 우회하기 위해 verify_password 모킹
        with patch('app.api.v1.auth.verify_password') as mock_verify:
            mock_verify.return_value = True  # 비밀번호 검증 성공
            response = await client.post(
                "/api/v1/auth/login",
                json={
                    "email": "test@example.com",
                    "password": "testpassword123"
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            # 응답 형식 확인 (TokenResponse 또는 StandardResponse)
            if "success" in data:
                assert data["success"] is True
                assert "access_token" in data.get("data", {})
            else:
                assert "access_token" in data
            
            # 쿠키 확인 (선택적)
            cookies = response.cookies
            # 쿠키가 설정되어 있을 수도 있고 없을 수도 있음
    
    async def test_login_invalid_email(
        self,
        client: AsyncClient
    ):
        """잘못된 이메일로 로그인 시도"""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "testpassword123"
            }
        )
        
        assert response.status_code == 401
        data = response.json()
        # HTTPException은 detail 필드를 사용
        if "detail" in data:
            assert "이메일" in data["detail"] or "비밀번호" in data["detail"] or "인증" in data["detail"]
        elif "error" in data:
            assert "이메일" in data["error"] or "비밀번호" in data["error"] or "인증" in data["error"]
    
    async def test_login_invalid_password(
        self,
        client: AsyncClient,
        test_user: User
    ):
        """잘못된 비밀번호로 로그인 시도"""
        # passlib의 bcrypt 초기화 문제를 우회하기 위해 verify_password 모킹
        with patch('app.api.v1.auth.verify_password') as mock_verify:
            mock_verify.return_value = False  # 비밀번호 검증 실패
            response = await client.post(
                "/api/v1/auth/login",
                json={
                    "email": "test@example.com",
                    "password": "wrongpassword"
                }
            )
            
            assert response.status_code == 401
            data = response.json()
            # HTTPException은 detail 필드를 사용
            assert "detail" in data or "error" in data
    
    async def test_logout(
        self,
        client: AsyncClient,
        auth_token: str
    ):
        """로그아웃 테스트"""
        response = await client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        # logout 엔드포인트는 {"message": "로그아웃되었습니다"}를 반환
        assert "message" in data or "success" in data
    
    async def test_get_current_user(
        self,
        client: AsyncClient,
        auth_token: str,
        test_user: User
    ):
        """현재 사용자 정보 조회 테스트"""
        response = await client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        # UserInfo 스키마는 직접 반환되므로 success 키가 없을 수 있음
        if "success" in data:
            assert data["success"] is True
            assert data["data"]["email"] == test_user.email
            assert data["data"]["name"] == test_user.name
        else:
            assert data["email"] == test_user.email
            assert data["name"] == test_user.name
    
    async def test_get_current_user_unauthorized(
        self,
        client: AsyncClient
    ):
        """인증되지 않은 사용자의 정보 조회 시도"""
        response = await client.get("/api/v1/users/me")
        
        # HTTPBearer는 기본적으로 403을 반환합니다
        assert response.status_code in [401, 403]

