# 니어카 데이터베이스 관리

본 디렉토리는 니어카 프로젝트의 데이터베이스 스키마 및 마이그레이션 스크립트를 관리합니다.

## 디렉토리 구조

```
backend/database/
├── migrations/          # 데이터베이스 마이그레이션 스크립트
│   └── 001_initial_schema.sql
├── schemas/            # 스키마 설계 문서
│   ├── erd.md         # ERD 설계 문서
│   └── schema_design.md # 스키마 상세 설계 문서
└── seeds/              # 초기 데이터 시드 스크립트 (예정)
```

## 데이터베이스 설정

### 1. PostgreSQL 설치 및 데이터베이스 생성

PostgreSQL 15+ 버전이 필요합니다.

```bash
# PostgreSQL 설치 확인
psql --version

# 데이터베이스 생성
createdb nearcar_db

# 또는 psql에서 직접 생성
psql -U postgres
CREATE DATABASE nearcar_db
    WITH 
    OWNER = postgres
    ENCODING = 'UTF8'
    LC_COLLATE = 'ko_KR.UTF-8'
    LC_CTYPE = 'ko_KR.UTF-8'
    TEMPLATE = template0;
```

### 2. 환경 변수 설정

`.env` 파일에 다음 정보를 설정합니다:

```env
# 데이터베이스 연결 정보
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nearcar_db
DB_USER=postgres
DB_PASSWORD=your_password

# 암호화 키 (AES-256)
ENCRYPTION_KEY=your_32_byte_encryption_key_here
```

### 3. 마이그레이션 실행

#### 방법 1: psql 명령어 사용

```bash
# 데이터베이스에 연결하여 스크립트 실행
psql -U postgres -d nearcar_db -f migrations/001_initial_schema.sql

# 또는 환경 변수 사용
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f migrations/001_initial_schema.sql
```

#### 방법 2: Python 스크립트 사용 (예정)

```bash
# Python 가상환경 활성화 후
python scripts/run_migration.py migrations/001_initial_schema.sql
```

## 스키마 검증

### 1. 테이블 목록 확인

```sql
\dt
```

또는

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

### 2. 테이블 구조 확인

```sql
\d users
\d vehicles
\d inspections
```

### 3. 제약조건 확인

```sql
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    conrelid::regclass AS table_name
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
ORDER BY table_name, constraint_type;
```

### 4. 인덱스 확인

```sql
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

## 제약조건 테스트

### 1. 외래키 제약조건 테스트

```sql
-- 잘못된 외래키 삽입 시도 (실패해야 함)
INSERT INTO vehicles (user_id, master_id, plate_number, production_year, fuel_type)
VALUES ('00000000-0000-0000-0000-000000000000', 
        '00000000-0000-0000-0000-000000000000',
        '12가3456', 2020, 'gasoline');
-- ERROR: insert or update on table "vehicles" violates foreign key constraint
```

### 2. CHECK 제약조건 테스트

```sql
-- 잘못된 상태 값 삽입 시도 (실패해야 함)
INSERT INTO inspections (user_id, vehicle_id, package_id, status, schedule_date, schedule_time, location_address, total_amount)
VALUES ('...', '...', '...', 'invalid_status', '2025-12-07', '10:00:00', '서울시 강남구', 50000);
-- ERROR: new row for relation "inspections" violates check constraint
```

### 3. UNIQUE 제약조건 테스트

```sql
-- 중복된 지역 삽입 시도 (실패해야 함)
INSERT INTO service_regions (province, city, extra_fee)
VALUES ('서울', '강남구', 0);
INSERT INTO service_regions (province, city, extra_fee)
VALUES ('서울', '강남구', 0);
-- ERROR: duplicate key value violates unique constraint
```

## 롤백 (스키마 삭제)

⚠️ **주의**: 이 작업은 모든 데이터를 삭제합니다. 프로덕션 환경에서는 사용하지 마세요.

```sql
-- 모든 테이블 삭제 (의존성 순서 고려)
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS settlements CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS inspection_reports CASCADE;
DROP TABLE IF EXISTS inspections CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS packages CASCADE;
DROP TABLE IF EXISTS price_policies CASCADE;
DROP TABLE IF EXISTS vehicle_master CASCADE;
DROP TABLE IF EXISTS service_regions CASCADE;

-- 함수 삭제
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- 확장 삭제 (선택적)
DROP EXTENSION IF EXISTS "pgcrypto" CASCADE;
DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;
```

## 다음 단계

1. ✅ 초기 스키마 생성 완료
2. ⏳ 초기 데이터 시드 스크립트 작성 (작업 11.4)
3. ⏳ 애플리케이션 레벨 암호화 함수 구현
4. ⏳ 성능 테스트 및 최적화

## 참고 문서

- [ERD 설계 문서](./schemas/erd.md)
- [스키마 상세 설계 문서](./schemas/schema_design.md)
- [PostgreSQL 공식 문서](https://www.postgresql.org/docs/)

