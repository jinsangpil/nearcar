# 테스트 가이드

이 디렉토리는 NearCar 백엔드의 테스트 코드를 포함합니다.

## 테스트 구조

```
tests/
├── __init__.py
├── conftest.py              # pytest 설정 및 공통 fixtures
├── test_services/           # 서비스 레이어 테스트
│   ├── test_pricing_service.py
│   └── test_payment_service.py
└── test_api/                # API 엔드포인트 테스트
    ├── test_auth.py
    └── test_checklists.py
```

## 테스트 실행 방법

### 모든 테스트 실행

```bash
# 가상환경 활성화
source venv/bin/activate

# 모든 테스트 실행
pytest

# 상세 출력과 함께 실행
pytest -v

# 특정 테스트 파일 실행
pytest tests/test_services/test_pricing_service.py

# 특정 테스트 클래스 실행
pytest tests/test_services/test_pricing_service.py::TestPricingService

# 특정 테스트 메서드 실행
pytest tests/test_services/test_pricing_service.py::TestPricingService::test_calculate_quote_basic
```

### 테스트 마커 사용

```bash
# 단위 테스트만 실행
pytest -m unit

# API 테스트만 실행
pytest -m api

# 통합 테스트만 실행
pytest -m integration

# 느린 테스트 제외
pytest -m "not slow"
```

### 커버리지 확인

```bash
# pytest-cov 설치 (필요시)
pip install pytest-cov

# 커버리지와 함께 테스트 실행
pytest --cov=app --cov-report=html

# HTML 리포트 확인
open htmlcov/index.html
```

## 테스트 데이터베이스

테스트는 SQLite in-memory 데이터베이스를 사용합니다. 각 테스트마다 새로운 데이터베이스가 생성되고 테스트 종료 시 자동으로 정리됩니다.

## Fixtures

### 공통 Fixtures (conftest.py)

- `db_session`: 테스트용 데이터베이스 세션
- `client`: FastAPI 테스트 클라이언트
- `test_user`: 테스트용 일반 사용자
- `test_admin_user`: 테스트용 관리자 사용자
- `test_inspector_user`: 테스트용 기사 사용자
- `auth_token`: 일반 사용자 JWT 토큰
- `admin_token`: 관리자 JWT 토큰
- `inspector_token`: 기사 JWT 토큰
- `mock_redis`: Redis 모킹
- `mock_s3_client`: AWS S3 클라이언트 모킹
- `mock_toss_payment_service`: 토스페이먼츠 서비스 모킹
- `mock_channel_service`: 채널 서비스 모킹

## 테스트 작성 가이드

### 서비스 레이어 테스트

서비스 레이어 테스트는 비즈니스 로직의 정확성을 검증합니다.

```python
@pytest.mark.asyncio
@pytest.mark.unit
class TestPricingService:
    async def test_calculate_quote_basic(self, db_session: AsyncSession):
        # 테스트 데이터 준비
        # 서비스 메서드 호출
        # 결과 검증
        pass
```

### API 엔드포인트 테스트

API 엔드포인트 테스트는 HTTP 요청/응답을 검증합니다.

```python
@pytest.mark.asyncio
@pytest.mark.api
class TestAuthAPI:
    async def test_login_success(self, client: AsyncClient, test_user: User):
        response = await client.post("/api/v1/auth/login", json={...})
        assert response.status_code == 200
        assert response.json()["success"] is True
```

## 주의사항

1. **테스트 격리**: 각 테스트는 독립적으로 실행되어야 합니다.
2. **데이터 정리**: 테스트 후 데이터는 자동으로 정리되지만, 외부 서비스 모킹은 필수입니다.
3. **비동기 테스트**: 모든 테스트는 `@pytest.mark.asyncio` 데코레이터를 사용합니다.
4. **마커 사용**: 테스트 유형에 맞는 마커를 사용하여 테스트를 분류합니다.

## 외부 서비스 모킹

테스트에서는 다음 외부 서비스를 모킹합니다:

- **Redis**: `mock_redis` fixture 사용
- **AWS S3**: `mock_s3_client` fixture 사용
- **토스페이먼츠**: `mock_toss_payment_service` fixture 사용
- **알림 채널**: `mock_channel_service` fixture 사용

## CI/CD 통합

CI/CD 파이프라인에서 테스트를 실행하려면:

```yaml
# 예시: GitHub Actions
- name: Run tests
  run: |
    pip install -r requirements.txt
    pytest --cov=app --cov-report=xml
```

## 문제 해결

### 테스트가 실패하는 경우

1. **데이터베이스 연결 오류**: SQLite가 제대로 설치되어 있는지 확인
2. **비동기 관련 오류**: `pytest-asyncio`가 설치되어 있는지 확인
3. **Import 오류**: `PYTHONPATH`가 올바르게 설정되어 있는지 확인

### 테스트 실행이 느린 경우

- 느린 테스트는 `@pytest.mark.slow` 마커를 사용하여 제외할 수 있습니다.
- 병렬 실행을 위해 `pytest-xdist`를 사용할 수 있습니다:

```bash
pip install pytest-xdist
pytest -n auto  # CPU 코어 수만큼 병렬 실행
```

