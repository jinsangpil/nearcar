# NearCar V2

차량 진단 서비스 플랫폼 (V2)

## 프로젝트 개요

NearCar는 고객이 차량 진단을 신청하고, 전문 기사가 현장에서 진단을 수행하여 리포트를 제공하는 통합 웹 플랫폼입니다.

## 기술 스택

### Backend
- **Framework**: FastAPI 0.109+
- **Database**: PostgreSQL 15+
- **Cache**: Redis
- **Language**: Python 3.11+
- **Authentication**: JWT (PyJWT)
- **ORM**: SQLAlchemy 2.0 (Async)

### Frontend (예정)
- **Framework**: Next.js 14+
- **Language**: TypeScript
- **State Management**: Zustand
- **Data Fetching**: TanStack Query
- **Styling**: TailwindCSS

## 프로젝트 구조

```
nearcar_v2/
├── backend/              # FastAPI 백엔드
│   ├── app/             # 애플리케이션 소스 코드
│   │   ├── api/        # API 엔드포인트
│   │   ├── core/       # 핵심 설정 및 유틸리티
│   │   ├── models/     # 데이터베이스 모델
│   │   └── schemas/    # Pydantic 스키마
│   ├── database/       # 데이터베이스 관련 파일
│   │   ├── migrations/ # 마이그레이션 스크립트
│   │   ├── schemas/    # 스키마 설계 문서
│   │   └── seeds/      # 초기 데이터 시드
│   └── requirements.txt
├── script/              # 참고 문서 및 스크립트
└── .taskmaster/         # Task Master 작업 관리
```

## 시작하기

### 사전 요구사항

- Python 3.11+
- PostgreSQL 15+
- Redis
- Node.js 18+ (프론트엔드용)

### 백엔드 설정

1. **가상환경 생성 및 활성화**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
```

2. **의존성 설치**
```bash
pip install -r requirements.txt
```

3. **환경 변수 설정**
```bash
cp .env.example .env
# .env 파일을 편집하여 데이터베이스 및 API 키 설정
```

4. **데이터베이스 마이그레이션**
```bash
# PostgreSQL 데이터베이스 생성
createdb nearcar_db

# 스키마 생성
psql -U postgres -d nearcar_db -f database/migrations/001_initial_schema.sql

# 초기 데이터 시드
psql -U postgres -d nearcar_db -f database/seeds/001_initial_data.sql
```

5. **서버 실행**
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 주요 기능

### 완료된 기능
- ✅ 데이터베이스 스키마 설계 및 구축
- ✅ JWT 기반 인증 시스템
- ✅ 역할 기반 접근 제어 (RBAC)
- ✅ 비회원 인증 처리
- ✅ Redis 연동

### 진행 중인 기능
- 🔄 차량 마스터 데이터 API
- 🔄 동적 가격 계산 엔진
- 🔄 결제 시스템 통합

## API 문서

서버 실행 후 다음 URL에서 API 문서를 확인할 수 있습니다:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 라이선스

이 프로젝트는 비공개 프로젝트입니다.

## 기여

이 프로젝트는 내부 프로젝트입니다.

