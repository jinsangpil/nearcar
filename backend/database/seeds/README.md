# 니어카 데이터베이스 시드 데이터

본 디렉토리는 데이터베이스 초기 데이터 시드 스크립트를 관리합니다.

## 파일 구조

```
backend/database/seeds/
├── 001_initial_data.sql    # 초기 데이터 시드 스크립트
└── README.md               # 본 문서
```

## 실행 방법

### 1. 마이그레이션 실행 후 시드 데이터 삽입

```bash
# 데이터베이스에 연결하여 시드 스크립트 실행
psql -U postgres -d nearcar_db -f seeds/001_initial_data.sql

# 또는 환경 변수 사용
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f seeds/001_initial_data.sql
```

### 2. 데이터 검증

시드 스크립트 실행 후 다음 쿼리로 데이터를 확인할 수 있습니다:

```sql
-- 각 테이블의 데이터 개수 확인
SELECT 'service_regions' AS table_name, COUNT(*) AS count FROM service_regions
UNION ALL
SELECT 'price_policies', COUNT(*) FROM price_policies
UNION ALL
SELECT 'packages', COUNT(*) FROM packages
UNION ALL
SELECT 'vehicle_master', COUNT(*) FROM vehicle_master;

-- 차량 마스터 데이터 통계
SELECT 
    origin,
    manufacturer,
    COUNT(*) AS model_count
FROM vehicle_master
GROUP BY origin, manufacturer
ORDER BY origin, manufacturer;
```

## 포함된 데이터

### 1. 서비스 지역 (service_regions)
- 서울 25개 구
- 경기 20개 시
- 인천 10개 구/군
- 기타 광역시 (부산, 대구, 광주, 대전, 울산)

### 2. 가격 정책 (price_policies)
- 국산차: compact, small, mid (0원), large (10,000원), suv (15,000원), sports (30,000원), supercar (50,000원)
- 수입차: compact, small (10,000원), mid (20,000원), large (30,000원), suv (40,000원), sports (50,000원), supercar (100,000원)

### 3. 진단 패키지 (packages)
- 라이트A: 50,000원
- 라이트B: 70,000원
- 스탠다드: 100,000원
- 프리미엄: 150,000원
- 풀패키지: 200,000원

### 4. 차량 마스터 데이터 (vehicle_master)
- 국산차: 현대, 기아, 쌍용, 제네시스 주요 모델 (약 40개)
- 수입차: BMW, 벤츠, 아우디, 포르쉐, 테슬라, 렉서스, 볼보 주요 모델 (약 50개)

## 롤백 (데이터 삭제)

⚠️ **주의**: 이 작업은 모든 시드 데이터를 삭제합니다.

```sql
-- 외래키 제약조건 때문에 순서 중요
DELETE FROM vehicle_master;
DELETE FROM packages;
DELETE FROM price_policies;
DELETE FROM service_regions;
```

## 데이터 추가/수정

### 차량 마스터 데이터 추가

```sql
INSERT INTO vehicle_master (origin, manufacturer, model_group, model_detail, vehicle_class, start_year, end_year, is_active)
VALUES ('domestic', '현대', '아이오닉', '아이오닉 6', 'mid', 2022, NULL, true);
```

### 패키지 데이터 수정

```sql
UPDATE packages
SET base_price = 55000
WHERE name = '라이트A';
```

## 다음 단계

1. ✅ 초기 데이터 시드 스크립트 작성 완료
2. ⏳ 실제 운영 데이터로 대체 (필요 시)
3. ⏳ 관리자 계정 초기 설정 (애플리케이션 레벨에서 구현)

