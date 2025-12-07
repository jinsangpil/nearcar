# DB Schema - 니어카

본 문서는 니어카 V1 통합 웹 시스템의 데이터베이스 스키마를 정의합니다.
TRD v1.2를 반영하여 차량 마스터 데이터, 지역별/차종별 가격 정책, 패키지 관리를 위한 테이블이 추가되었습니다.

> **참고**: V2 확장을 고려하여 모든 Primary Key는 UUID 타입을 권장하지만, 개발 편의성을 위해 초기에는 SERIAL(Auto Increment)을 사용할 수도 있습니다. 본 문서는 UUID 기준으로 작성되었습니다.

---

## 1. users 테이블 (사용자)

사용자, 기사, 관리자 정보를 통합 관리합니다.

| 컬럼 | 타입 | 설명 | 비고 |
|------|------|------|------|
| id | UUID PK | 사용자 고유 ID | gen_random_uuid() |
| role | VARCHAR(20) | 사용자 역할 | client, inspector, admin, staff |
| name | VARCHAR(100) | 이름 | |
| phone | VARCHAR(256) | 휴대폰 번호 | AES-256 암호화 저장 |
| email | VARCHAR(100) | 이메일 | 선택 사항 |
| password_hash | VARCHAR(256) | 비밀번호 해시 | 비회원은 NULL |
| region_id | UUID FK | 활동 지역 ID | service_regions.id (기사 전용) |
| level | INT | 기사 등급 | 1~5 (기사 전용) |
| commission_rate | DECIMAL(5,2) | 기사 수수료율 | 예: 0.70 (기사 전용) |
| status | VARCHAR(20) | 계정 상태 | active, inactive, suspended |
| created_at | TIMESTAMP | 생성일 | |
| updated_at | TIMESTAMP | 수정일 | |

---

## 2. Reference Data (기준 정보)

### 2.1 service_regions (서비스 지역)

지역별 출장비 할증 관리를 위한 테이블입니다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | 지역 ID |
| province | VARCHAR(50) | 도/광역시 (예: 서울, 경기) |
| city | VARCHAR(50) | 시/구 (예: 강남구, 분당구) |
| extra_fee | INT | 지역 할증 요금 |
| is_active | BOOLEAN | 서비스 가능 여부 |

### 2.2 vehicle_master (차량 마스터)

필터링 및 견적 산출의 기준이 되는 제조사/모델 계층 데이터입니다.

| 컬럼 | 타입 | 설명 | 비고 |
|------|------|------|------|
| id | UUID PK | 마스터 ID | |
| origin | VARCHAR(20) | 제조국 구분 | domestic, imported |
| manufacturer | VARCHAR(50) | 제조사 | 현대, BMW 등 |
| model_group | VARCHAR(100) | 모델명 | 그랜저, 5시리즈 |
| model_detail | VARCHAR(100) | 상세 모델 | 더 뉴 그랜저 IG |
| vehicle_class | VARCHAR(20) | 차량 등급 | compact, mid, large, suv, supercar... |
| start_year | INT | 출시 연도 | |
| end_year | INT | 단종 연도 | 생산 중이면 NULL |
| is_active | BOOLEAN | 사용 여부 | |

### 2.3 packages (진단 패키지)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | 패키지 ID |
| name | VARCHAR(50) | 패키지명 |
| base_price | INT | 기본 가격 |
| included_items | JSONB | 포함 항목 |
| is_active | BOOLEAN | 판매 여부 |

### 2.4 price_policies (가격 정책)

차량 등급(Class)에 따른 추가 요금 정책입니다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | 정책 ID |
| origin | VARCHAR(20) | 국산/수입 구분 |
| vehicle_class | VARCHAR(20) | 차량 등급 |
| add_amount | INT | 추가 요금 |

---

## 3. vehicles 테이블 (등록 차량)

고객이 진단을 요청한 개별 차량 정보입니다.

| 컬럼 | 타입 | 설명 | 비고 |
|------|------|------|------|
| id | UUID PK | 차량 ID | |
| user_id | UUID FK | 소유주 ID | users.id |
| master_id | UUID FK | 마스터 데이터 ID | vehicle_master.id |
| plate_number | VARCHAR(20) | 차량 번호 | |
| production_year | INT | 연식 | |
| fuel_type | VARCHAR(20) | 연료 타입 | gasoline, diesel, electric... |
| owner_change_cnt | INT | 소유자 변경 횟수 | |
| is_flooded | BOOLEAN | 침수 여부 | Car365 조회 결과 |
| created_at | TIMESTAMP | 생성일 | |

---

## 4. inspections 테이블 (진단 신청)

기존 applications 테이블의 명칭을 TRD에 맞춰 변경하였습니다.

| 컬럼 | 타입 | 설명 | 비고 |
|------|------|------|------|
| id | UUID PK | 신청 ID | |
| user_id | UUID FK | 고객 ID | |
| inspector_id | UUID FK | 배정 기사 ID | NULL 가능 |
| vehicle_id | UUID FK | 차량 ID | |
| package_id | UUID FK | 패키지 ID | |
| status | VARCHAR(20) | 진행 상태 | requested, assigned, report_submitted, sent, cancelled |
| schedule_date | DATE | 예약 날짜 | |
| schedule_time | TIME | 예약 시간 | |
| location_address | VARCHAR(255) | 진단 장소 | |
| total_amount | INT | 최종 결제 금액 | 패키지+차종할증+지역할증 합계 |
| created_at | TIMESTAMP | 생성일 | |
| updated_at | TIMESTAMP | 수정일 | |

---

## 5. inspection_reports 테이블

| 컬럼 | 타입 | 설명 | 비고 |
|------|------|------|------|
| id | UUID PK | 레포트 ID | |
| inspection_id | UUID FK | 신청 ID | |
| checklist_data | JSONB | 체크리스트 결과 | {"engine": "good", "tire": "warn"} |
| images | JSONB | 사진 URL 리스트 | [{"sec": "front", "url": "..."}] |
| videos | JSONB | 영상 URL 리스트 | |
| inspector_comment | TEXT | 종합 의견 | |
| repair_cost_est | INT | 예상 수리비 | |
| pdf_url | VARCHAR(255) | PDF 파일 경로 | S3 URL |
| status | VARCHAR(20) | 레포트 상태 | submitted, reviewed |
| created_at | TIMESTAMP | 생성일 | |

---

## 6. settlements 테이블 (정산)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | 정산 ID |
| inspector_id | UUID FK | 기사 ID |
| inspection_id | UUID FK | 관련 진단 건 ID |
| total_sales | INT | 해당 건 매출액 |
| fee_rate | DECIMAL(5,2) | 적용 수수료율 |
| settle_amount | INT | 지급 예정액 |
| status | VARCHAR(20) | 정산 상태 |
| settle_date | DATE | 정산 기준일 |
| created_at | TIMESTAMP | 생성일 |

---

## 7. payments 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | 결제 ID |
| inspection_id | UUID FK | 신청 ID |
| amount | INT | 결제 금액 |
| method | VARCHAR(20) | 결제 수단 |
| pg_provider | VARCHAR(20) | PG사 |
| transaction_id | VARCHAR(100) | 거래 고유 번호 |
| status | VARCHAR(20) | 상태 |
| paid_at | TIMESTAMP | 결제 완료일 |

---

## 8. notifications 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | SERIAL PK | 알림 ID |
| user_id | UUID FK | 수신자 ID |
| channel | VARCHAR(20) | 채널 |
| template_id | VARCHAR(50) | 템플릿 코드 |
| content | TEXT | 발송 내용 |
| status | VARCHAR(20) | 상태 |
| created_at | TIMESTAMP | 발송 시간 |

---

## 9. Entity Relationships (ERD 요약)

- **User (1) : (N) Vehicles**
- **VehicleMaster (1) : (N) Vehicles**
- **ServiceRegions (1) : (N) Users** (Inspector 활동지역)
- **ServiceRegions (1) : (N) Inspections** (진단 지역)
- **Inspections (1) : (1) InspectionReports**
- **Inspections (1) : (1) Payments**
- **Inspections (1) : (1) Settlements**
- **Packages (1) : (N) Inspections**

---

## 10. 설계 원칙 (Design Principles)

### 정규화 (Normalization)
차량 정보는 `vehicle_master`로, 가격 정책은 `price_policies`로 분리하여 데이터 중복을 최소화합니다.

### 이력 관리 (History)
수수료율(`commission_rate`)이나 가격 정책이 변경되더라도, 이미 완료된 정산(`settlements`) 데이터는 생성 시점의 값을 스냅샷으로 저장하여 변하지 않도록 합니다.

### 유연성 (Flexibility)
진단 항목(`checklist_data`)과 이미지(`images`)는 JSONB 타입을 사용하여 항목 변경 시 스키마 수정 없이 대응합니다.

### 보안 (Security)
개인정보(전화번호)는 반드시 애플리케이션 레벨에서 암호화 후 저장합니다.