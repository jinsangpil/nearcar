# 니어카 데이터베이스 성능 최적화 전략

본 문서는 니어카 데이터베이스의 성능 최적화 전략 및 인덱스 관리 방안을 정의합니다.

## 1. 인덱스 현황

### 1.1 생성된 인덱스 목록

#### users 테이블
- `idx_users_region_id`: 기사 활동 지역 조회용
- `idx_users_role`: 역할별 사용자 조회용
- `idx_users_status`: 상태별 사용자 조회용
- `idx_users_phone_hash`: 암호화된 전화번호 검색용 (HASH 인덱스)

#### vehicles 테이블
- `idx_vehicles_user_id`: 사용자별 차량 조회용
- `idx_vehicles_master_id`: 마스터 데이터별 차량 조회용
- `idx_vehicles_plate_number`: 차량 번호 검색용

#### vehicle_master 테이블
- `idx_vehicle_master_origin`: 제조국별 조회용
- `idx_vehicle_master_manufacturer`: 제조사별 조회용
- `idx_vehicle_master_vehicle_class`: 차량 등급별 조회용
- `idx_vehicle_master_active`: 활성 차량만 조회용 (부분 인덱스)

#### inspections 테이블
- `idx_inspections_user_id`: 고객별 신청 조회용
- `idx_inspections_inspector_id`: 기사별 배정 조회용 (부분 인덱스)
- `idx_inspections_vehicle_id`: 차량별 신청 조회용
- `idx_inspections_status`: 상태별 조회용
- `idx_inspections_schedule_date`: 일정별 조회용
- `idx_inspections_created_at`: 생성일순 정렬용
- `idx_inspections_status_date`: 상태+일정 복합 인덱스
- `idx_inspections_inspector_status`: 기사+상태 복합 인덱스 (부분 인덱스)

#### inspection_reports 테이블
- `idx_inspection_reports_status`: 상태별 조회용
- `idx_inspection_reports_checklist_gin`: 체크리스트 JSONB 검색용 (GIN 인덱스)
- `idx_inspection_reports_images_gin`: 이미지 JSONB 검색용 (GIN 인덱스)

#### payments 테이블
- `idx_payments_status`: 상태별 조회용
- `idx_payments_transaction_id`: 거래 ID 검색용 (부분 인덱스)
- `idx_payments_paid_at`: 결제일순 정렬용 (부분 인덱스)

#### settlements 테이블
- `idx_settlements_inspector_id`: 기사별 정산 조회용
- `idx_settlements_status`: 상태별 조회용
- `idx_settlements_settle_date`: 정산일순 정렬용

#### notifications 테이블
- `idx_notifications_user_id`: 사용자별 알림 조회용
- `idx_notifications_status`: 상태별 조회용
- `idx_notifications_created_at`: 생성일순 정렬용

#### price_policies 테이블
- `idx_price_policies_lookup`: origin+vehicle_class 복합 인덱스 (가격 조회용)

## 2. 주요 쿼리 패턴 및 성능 분석

### 2.1 차량 마스터 데이터 조회 (목표: 100ms 이내)

**쿼리 패턴 1**: 제조사별 차량 목록 조회
```sql
EXPLAIN ANALYZE
SELECT id, manufacturer, model_group, vehicle_class
FROM vehicle_master
WHERE manufacturer = '현대' AND is_active = true
ORDER BY model_group;
```

**예상 실행 계획**:
- `idx_vehicle_master_manufacturer` 인덱스 사용
- `idx_vehicle_master_active` 부분 인덱스와 결합
- Index Scan 예상

**최적화 방안**:
- 복합 인덱스 고려: `CREATE INDEX idx_vehicle_master_manufacturer_active ON vehicle_master(manufacturer, is_active) WHERE is_active = true;`

**쿼리 패턴 2**: 차량 등급별 가격 정책 조회
```sql
EXPLAIN ANALYZE
SELECT add_amount
FROM price_policies
WHERE origin = 'domestic' AND vehicle_class = 'mid';
```

**예상 실행 계획**:
- `idx_price_policies_lookup` 복합 인덱스 사용
- Index Only Scan 예상

### 2.2 진단 신청 조회 (목표: 100ms 이내)

**쿼리 패턴 3**: 기사별 대기 중인 신청 조회
```sql
EXPLAIN ANALYZE
SELECT i.id, i.schedule_date, i.schedule_time, i.location_address,
       v.plate_number, vm.manufacturer, vm.model_group
FROM inspections i
JOIN vehicles v ON i.vehicle_id = v.id
JOIN vehicle_master vm ON v.master_id = vm.id
WHERE i.inspector_id = '...' AND i.status = 'assigned'
ORDER BY i.schedule_date, i.schedule_time;
```

**예상 실행 계획**:
- `idx_inspections_inspector_status` 복합 인덱스 사용
- Nested Loop Join 예상
- 추가 최적화: `idx_inspections_status_date` 인덱스 활용 고려

**쿼리 패턴 4**: 고객별 신청 이력 조회
```sql
EXPLAIN ANALYZE
SELECT i.id, i.status, i.schedule_date, i.total_amount,
       p.name AS package_name
FROM inspections i
JOIN packages p ON i.package_id = p.id
WHERE i.user_id = '...'
ORDER BY i.created_at DESC
LIMIT 20;
```

**예상 실행 계획**:
- `idx_inspections_user_id` 인덱스 사용
- `idx_inspections_created_at` 인덱스와 결합
- Limit을 활용한 효율적인 조회

### 2.3 JSONB 필드 검색 (목표: 200ms 이내)

**쿼리 패턴 5**: 체크리스트 결과 검색
```sql
EXPLAIN ANALYZE
SELECT id, inspection_id, checklist_data
FROM inspection_reports
WHERE checklist_data @> '{"exterior": {"front_glass": {"status": "warn"}}}';
```

**예상 실행 계획**:
- `idx_inspection_reports_checklist_gin` GIN 인덱스 사용
- GIN Index Scan 예상

**쿼리 패턴 6**: 이미지가 있는 레포트 조회
```sql
EXPLAIN ANALYZE
SELECT id, inspection_id, images
FROM inspection_reports
WHERE jsonb_array_length(images) > 0;
```

**예상 실행 계획**:
- `idx_inspection_reports_images_gin` GIN 인덱스 사용
- GIN Index Scan 예상

## 3. 파티셔닝 전략 검토

### 3.1 inspections 테이블 파티셔닝

**현재 상황**:
- inspections 테이블은 시간이 지날수록 데이터가 증가
- 대부분의 조회가 최근 데이터에 집중

**파티셔닝 전략**:
- **Range 파티셔닝**: `created_at` 기준으로 월별 파티션
- **파티션 키**: `created_at`
- **파티션 단위**: 월별 (예: 2025-12, 2026-01)

**예상 효과**:
- 오래된 데이터 조회 시 불필요한 파티션 스캔 방지
- 인덱스 크기 감소
- VACUUM 성능 향상

**구현 시점**:
- 데이터가 100만 건 이상일 때 고려
- 초기에는 파티셔닝 없이 진행

### 3.2 notifications 테이블 파티셔닝

**현재 상황**:
- notifications 테이블은 알림 이력 저장용
- 오래된 알림은 거의 조회되지 않음

**파티셔닝 전략**:
- **Range 파티셔닝**: `created_at` 기준으로 월별 파티션
- 오래된 파티션은 아카이빙 또는 삭제

**구현 시점**:
- 데이터가 50만 건 이상일 때 고려

## 4. 인덱스 유지보수 전략

### 4.1 정기적인 인덱스 분석

**주기**: 월 1회

**분석 쿼리**:
```sql
-- 사용되지 않는 인덱스 확인
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- 인덱스 크기 확인
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC;
```

### 4.2 인덱스 재구성 (REINDEX)

**주기**: 분기별 1회

**실행 스크립트**:
```sql
-- 특정 인덱스 재구성
REINDEX INDEX CONCURRENTLY idx_inspections_status_date;

-- 테이블의 모든 인덱스 재구성
REINDEX TABLE CONCURRENTLY inspections;

-- 데이터베이스 전체 재구성 (유지보수 시간에 실행)
-- REINDEX DATABASE nearcar_db;
```

**주의사항**:
- `CONCURRENTLY` 옵션 사용 시 테이블 잠금 없이 실행 가능
- 프로덕션 환경에서는 `CONCURRENTLY` 옵션 필수

### 4.3 테이블 통계 정보 업데이트 (VACUUM)

**주기**: 주 1회 (자동 VACUUM 설정 권장)

**실행 스크립트**:
```sql
-- 특정 테이블 VACUUM 및 ANALYZE
VACUUM ANALYZE inspections;

-- 데이터베이스 전체 VACUUM (유지보수 시간에 실행)
VACUUM ANALYZE;
```

**자동 VACUUM 설정** (`postgresql.conf`):
```ini
autovacuum = on
autovacuum_naptime = 1min
autovacuum_vacuum_threshold = 50
autovacuum_analyze_threshold = 50
autovacuum_vacuum_scale_factor = 0.2
autovacuum_analyze_scale_factor = 0.1
```

## 5. 성능 모니터링

### 5.1 주요 쿼리 성능 모니터링

**모니터링 대상 쿼리**:
1. 차량 마스터 데이터 조회 (목표: 100ms 이내)
2. 진단 신청 목록 조회 (목표: 100ms 이내)
3. JSONB 필드 검색 (목표: 200ms 이내)
4. 정산 집계 쿼리 (목표: 500ms 이내)

**모니터링 방법**:
```sql
-- pg_stat_statements 확장 활성화 (postgresql.conf)
shared_preload_libraries = 'pg_stat_statements'

-- 쿼리 성능 통계 조회
SELECT 
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    max_exec_time
FROM pg_stat_statements
WHERE query LIKE '%inspections%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### 5.2 인덱스 사용률 모니터링

**모니터링 쿼리**:
```sql
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC;
```

## 6. 최적화 체크리스트

### 6.1 인덱스 최적화
- [x] 주요 조회 필드에 인덱스 생성
- [x] JSONB 필드에 GIN 인덱스 적용
- [x] 복합 인덱스 설계 및 생성
- [ ] 사용되지 않는 인덱스 제거 (정기 모니터링 필요)
- [ ] 인덱스 크기 모니터링 및 최적화

### 6.2 쿼리 최적화
- [ ] EXPLAIN ANALYZE를 통한 쿼리 성능 분석
- [ ] 느린 쿼리 식별 및 최적화
- [ ] N+1 쿼리 문제 해결
- [ ] JOIN 최적화

### 6.3 파티셔닝
- [ ] inspections 테이블 파티셔닝 검토 (데이터 증가 시)
- [ ] notifications 테이블 파티셔닝 검토 (데이터 증가 시)

### 6.4 유지보수
- [ ] 자동 VACUUM 설정
- [ ] 정기적인 인덱스 재구성 스케줄 수립
- [ ] 성능 모니터링 대시보드 구축

## 7. 다음 단계

1. ✅ 인덱스 설계 및 생성 완료
2. ⏳ 실제 데이터로 성능 테스트 수행
3. ⏳ 느린 쿼리 식별 및 최적화
4. ⏳ 파티셔닝 전략 구현 (데이터 증가 시)
5. ⏳ 성능 모니터링 시스템 구축

