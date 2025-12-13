# 니어카 데이터베이스 스키마 상세 설계

본 문서는 ERD를 기반으로 한 PostgreSQL 데이터베이스 스키마의 상세 설계를 정의합니다.

## 1. 데이터베이스 생성

```sql
CREATE DATABASE nearcar_db
    WITH 
    OWNER = postgres
    ENCODING = 'UTF8'
    LC_COLLATE = 'ko_KR.UTF-8'
    LC_CTYPE = 'ko_KR.UTF-8'
    TEMPLATE = template0;

\c nearcar_db;

-- UUID 확장 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- 암호화 함수용
```

## 2. 테이블 생성 순서 (의존성 고려)

1. `service_regions` (독립적)
2. `vehicle_master` (독립적)
3. `price_policies` (독립적)
4. `packages` (독립적)
5. `users` (service_regions 참조)
6. `vehicles` (users, vehicle_master 참조)
7. `inspections` (users, vehicles, packages 참조)
8. `inspection_reports` (inspections 참조)
9. `payments` (inspections 참조)
10. `settlements` (users, inspections 참조)
11. `notifications` (users 참조)

## 3. 테이블 상세 스키마

### 3.1 service_regions (서비스 지역)

```sql
CREATE TABLE service_regions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    province VARCHAR(50) NOT NULL,
    city VARCHAR(50) NOT NULL,
    extra_fee INT NOT NULL DEFAULT 0 CHECK (extra_fee >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(province, city)
);

COMMENT ON TABLE service_regions IS '서비스 지역 및 지역별 출장비 관리';
COMMENT ON COLUMN service_regions.extra_fee IS '지역별 추가 출장비 (원 단위)';
```

### 3.2 vehicle_master (차량 마스터)

```sql
CREATE TABLE vehicle_master (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    origin VARCHAR(20) NOT NULL CHECK (origin IN ('domestic', 'imported')),
    manufacturer VARCHAR(50) NOT NULL,
    model_group VARCHAR(100) NOT NULL,
    model_detail VARCHAR(100),
    vehicle_class VARCHAR(20) NOT NULL CHECK (
        vehicle_class IN ('compact', 'small', 'mid', 'large', 'suv', 'sports', 'supercar')
    ),
    start_year INT NOT NULL CHECK (start_year >= 1900 AND start_year <= EXTRACT(YEAR FROM CURRENT_DATE) + 1),
    end_year INT CHECK (end_year IS NULL OR (end_year >= start_year AND end_year <= EXTRACT(YEAR FROM CURRENT_DATE) + 1)),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE vehicle_master IS '차량 마스터 데이터 (제조사/모델/등급 계층 구조)';
COMMENT ON COLUMN vehicle_master.vehicle_class IS '차량 등급 (가격 정책 매핑용)';
```

### 3.3 price_policies (가격 정책)

```sql
CREATE TABLE price_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    origin VARCHAR(20) NOT NULL CHECK (origin IN ('domestic', 'imported')),
    vehicle_class VARCHAR(20) NOT NULL CHECK (
        vehicle_class IN ('compact', 'small', 'mid', 'large', 'suv', 'sports', 'supercar')
    ),
    add_amount INT NOT NULL DEFAULT 0 CHECK (add_amount >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(origin, vehicle_class)
);

COMMENT ON TABLE price_policies IS '차량 등급별 추가 요금 정책';
COMMENT ON COLUMN price_policies.add_amount IS '기본 패키지 가격에 추가되는 할증 금액 (원 단위)';
```

### 3.4 packages (진단 패키지)

```sql
CREATE TABLE packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    base_price INT NOT NULL CHECK (base_price > 0),
    included_items JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE packages IS '진단 패키지 관리';
COMMENT ON COLUMN packages.included_items IS '포함된 진단 항목 리스트 (JSONB)';
```

### 3.5 users (사용자)

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role VARCHAR(20) NOT NULL CHECK (role IN ('client', 'inspector', 'staff', 'admin')),
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(256) NOT NULL, -- AES-256 암호화 저장
    email VARCHAR(100),
    password_hash VARCHAR(256), -- 비회원은 NULL
    level INT CHECK (level >= 1 AND level <= 5), -- 기사 등급 (1~5)
    commission_rate DECIMAL(5,2) CHECK (commission_rate >= 0 AND commission_rate <= 1), -- 기사 수수료율
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT inspector_level_check CHECK (
        (role = 'inspector' AND level IS NOT NULL) OR 
        (role != 'inspector')
    )
);

COMMENT ON TABLE users IS '사용자 통합 테이블 (고객/기사/운영자)';
COMMENT ON COLUMN users.phone IS '휴대폰 번호 (AES-256 암호화 저장)';
COMMENT ON COLUMN users.commission_rate IS '기사 수수료율 (예: 0.70 = 70%)';
```

### 3.5.1 inspector_regions (기사 활동 지역)

```sql
CREATE TABLE inspector_regions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    region_id UUID NOT NULL REFERENCES service_regions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_inspector_region UNIQUE (user_id, region_id)
);

CREATE INDEX idx_inspector_regions_user_id ON inspector_regions(user_id);
CREATE INDEX idx_inspector_regions_region_id ON inspector_regions(region_id);

COMMENT ON TABLE inspector_regions IS '기사 활동 지역 매핑 테이블 (다대다 관계)';
COMMENT ON COLUMN inspector_regions.user_id IS '기사 ID';
COMMENT ON COLUMN inspector_regions.region_id IS '활동 지역 ID';
```

### 3.6 vehicles (등록 차량)

```sql
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    master_id UUID NOT NULL REFERENCES vehicle_master(id) ON DELETE RESTRICT,
    plate_number VARCHAR(20) NOT NULL,
    production_year INT NOT NULL CHECK (
        production_year >= 1900 AND 
        production_year <= EXTRACT(YEAR FROM CURRENT_DATE) + 1
    ),
    fuel_type VARCHAR(20) NOT NULL CHECK (
        fuel_type IN ('gasoline', 'diesel', 'electric', 'hybrid', 'lpg', 'cng')
    ),
    owner_change_cnt INT NOT NULL DEFAULT 0 CHECK (owner_change_cnt >= 0),
    is_flooded BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE vehicles IS '고객이 신청한 개별 차량 정보';
COMMENT ON COLUMN vehicles.master_id IS '차량 마스터 데이터 매핑';
COMMENT ON COLUMN vehicles.is_flooded IS '침수 여부 (Car365 API 조회 결과)';
```

### 3.7 inspections (진단 신청)

```sql
CREATE TABLE inspections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    inspector_id UUID REFERENCES users(id) ON DELETE SET NULL,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    package_id UUID NOT NULL REFERENCES packages(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'requested' CHECK (
        status IN ('requested', 'assigned', 'scheduled', 'in_progress', 'report_submitted', 'sent', 'cancelled')
    ),
    schedule_date DATE NOT NULL,
    schedule_time TIME NOT NULL,
    location_address VARCHAR(255) NOT NULL,
    total_amount INT NOT NULL CHECK (total_amount > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT inspector_role_check CHECK (
        inspector_id IS NULL OR 
        EXISTS (SELECT 1 FROM users WHERE id = inspector_id AND role = 'inspector')
    )
);

COMMENT ON TABLE inspections IS '진단 신청 정보 및 상태 관리';
COMMENT ON COLUMN inspections.total_amount IS '최종 결제 금액 (패키지+차종할증+지역할증 합계)';
COMMENT ON COLUMN inspections.status IS '진행 상태: requested(접수) -> assigned(배정) -> scheduled(일정확정) -> in_progress(진행중) -> report_submitted(레포트제출) -> sent(발송완료)';
```

### 3.8 inspection_reports (진단 레포트)

```sql
CREATE TABLE inspection_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inspection_id UUID NOT NULL UNIQUE REFERENCES inspections(id) ON DELETE CASCADE,
    checklist_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    images JSONB DEFAULT '[]'::jsonb,
    videos JSONB DEFAULT '[]'::jsonb,
    inspector_comment TEXT,
    repair_cost_est INT CHECK (repair_cost_est >= 0),
    pdf_url VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewed', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE inspection_reports IS '진단 레포트 (체크리스트, 이미지, PDF)';
COMMENT ON COLUMN inspection_reports.checklist_data IS '체크리스트 결과 (JSONB)';
COMMENT ON COLUMN inspection_reports.images IS '사진 URL 리스트 (JSONB)';
```

### 3.9 payments (결제)

```sql
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inspection_id UUID NOT NULL UNIQUE REFERENCES inspections(id) ON DELETE CASCADE,
    amount INT NOT NULL CHECK (amount > 0),
    method VARCHAR(20) NOT NULL CHECK (method IN ('card', 'bank_transfer', 'virtual_account')),
    pg_provider VARCHAR(20) NOT NULL CHECK (pg_provider IN ('toss', 'iamport', 'kcp')),
    transaction_id VARCHAR(100) UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded')
    ),
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE payments IS '결제 정보';
COMMENT ON COLUMN payments.transaction_id IS 'PG사 거래 고유 번호';
```

### 3.10 settlements (정산)

```sql
CREATE TABLE settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inspector_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    inspection_id UUID NOT NULL UNIQUE REFERENCES inspections(id) ON DELETE CASCADE,
    total_sales INT NOT NULL CHECK (total_sales > 0),
    fee_rate DECIMAL(5,2) NOT NULL CHECK (fee_rate >= 0 AND fee_rate <= 1),
    settle_amount INT NOT NULL CHECK (settle_amount >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    settle_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT settle_amount_check CHECK (
        settle_amount = ROUND(total_sales * fee_rate)
    )
);

COMMENT ON TABLE settlements IS '기사 정산 내역';
COMMENT ON COLUMN settlements.fee_rate IS '적용 수수료율 (스냅샷 저장, 변경 불가)';
COMMENT ON COLUMN settlements.settle_amount IS '지급 예정액 (total_sales * fee_rate)';
```

### 3.11 notifications (알림)

```sql
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('alimtalk', 'sms', 'email', 'slack')),
    template_id VARCHAR(50),
    content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE notifications IS '알림 발송 이력';
COMMENT ON COLUMN notifications.template_id IS '알림 템플릿 코드';
```

## 4. 인덱스 설계

### 4.1 기본 인덱스 (Primary Key는 자동 생성)

### 4.2 외래키 인덱스 (자동 생성되지 않으므로 수동 생성)

```sql
-- users 테이블
CREATE INDEX idx_users_region_id ON users(region_id) WHERE region_id IS NOT NULL;
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_phone_hash ON users USING hash(phone); -- 암호화된 phone 검색용

-- vehicles 테이블
CREATE INDEX idx_vehicles_user_id ON vehicles(user_id);
CREATE INDEX idx_vehicles_master_id ON vehicles(master_id);
CREATE INDEX idx_vehicles_plate_number ON vehicles(plate_number);

-- vehicle_master 테이블
CREATE INDEX idx_vehicle_master_origin ON vehicle_master(origin);
CREATE INDEX idx_vehicle_master_manufacturer ON vehicle_master(manufacturer);
CREATE INDEX idx_vehicle_master_vehicle_class ON vehicle_master(vehicle_class);
CREATE INDEX idx_vehicle_master_active ON vehicle_master(is_active) WHERE is_active = true;

-- inspections 테이블
CREATE INDEX idx_inspections_user_id ON inspections(user_id);
CREATE INDEX idx_inspections_inspector_id ON inspections(inspector_id) WHERE inspector_id IS NOT NULL;
CREATE INDEX idx_inspections_vehicle_id ON inspections(vehicle_id);
CREATE INDEX idx_inspections_status ON inspections(status);
CREATE INDEX idx_inspections_schedule_date ON inspections(schedule_date);
CREATE INDEX idx_inspections_created_at ON inspections(created_at DESC);

-- 복합 인덱스
CREATE INDEX idx_inspections_status_date ON inspections(status, schedule_date);
CREATE INDEX idx_inspections_inspector_status ON inspections(inspector_id, status) WHERE inspector_id IS NOT NULL;

-- inspection_reports 테이블
CREATE INDEX idx_inspection_reports_status ON inspection_reports(status);
CREATE INDEX idx_inspection_reports_checklist_gin ON inspection_reports USING GIN(checklist_data);
CREATE INDEX idx_inspection_reports_images_gin ON inspection_reports USING GIN(images);

-- payments 테이블
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_transaction_id ON payments(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX idx_payments_paid_at ON payments(paid_at) WHERE paid_at IS NOT NULL;

-- settlements 테이블
CREATE INDEX idx_settlements_inspector_id ON settlements(inspector_id);
CREATE INDEX idx_settlements_status ON settlements(status);
CREATE INDEX idx_settlements_settle_date ON settlements(settle_date DESC);

-- notifications 테이블
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- price_policies 테이블
CREATE INDEX idx_price_policies_lookup ON price_policies(origin, vehicle_class);
```

## 5. 트리거 및 함수

### 5.1 updated_at 자동 업데이트 트리거

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_regions_updated_at BEFORE UPDATE ON service_regions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicle_master_updated_at BEFORE UPDATE ON vehicle_master
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_price_policies_updated_at BEFORE UPDATE ON price_policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_packages_updated_at BEFORE UPDATE ON packages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inspections_updated_at BEFORE UPDATE ON inspections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## 6. 뷰(View) 설계

### 6.1 기사 대시보드용 뷰

```sql
CREATE VIEW inspector_dashboard AS
SELECT 
    i.id,
    i.status,
    i.schedule_date,
    i.schedule_time,
    i.location_address,
    i.total_amount,
    v.plate_number,
    vm.manufacturer,
    vm.model_group,
    u_client.name AS client_name,
    u_client.phone AS client_phone
FROM inspections i
JOIN vehicles v ON i.vehicle_id = v.id
JOIN vehicle_master vm ON v.master_id = vm.id
JOIN users u_client ON i.user_id = u_client.id
WHERE i.inspector_id IS NOT NULL;

COMMENT ON VIEW inspector_dashboard IS '기사 대시보드용 진단 신청 정보 뷰';
```

### 6.2 정산 집계용 뷰

```sql
CREATE VIEW settlement_summary AS
SELECT 
    s.inspector_id,
    u.name AS inspector_name,
    DATE_TRUNC('month', s.settle_date) AS settle_month,
    COUNT(*) AS total_count,
    SUM(s.total_sales) AS total_sales,
    SUM(s.settle_amount) AS total_settle_amount,
    AVG(s.fee_rate) AS avg_fee_rate
FROM settlements s
JOIN users u ON s.inspector_id = u.id
WHERE s.status = 'completed'
GROUP BY s.inspector_id, u.name, DATE_TRUNC('month', s.settle_date);

COMMENT ON VIEW settlement_summary IS '기사별 월별 정산 집계 뷰';
```

## 7. 다음 단계

이 스키마 설계를 기반으로 다음 작업을 진행합니다:
1. SQL 마이그레이션 스크립트 작성
2. 초기 데이터 시드 스크립트 작성
3. 성능 테스트 및 최적화

