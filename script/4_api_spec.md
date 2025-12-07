# API Spec - 니어카

본 문서는 니어카 V1 서비스의 REST API 명세서입니다.
차량 마스터 데이터 기반의 필터링, 국토교통부 API 연동, 동적 견적 산출 로직이 반영되었습니다.

---

## 1. 인증 API (Auth)

### 1.1 비회원 인증번호 요청

**Endpoint:** `POST /auth/request-code`

**Request:**

```json
{
  "phone_number": "+821012345678"
}
```

**Response:**

```json
{
  "success": true,
  "message": "인증번호 발송 완료"
}
```

---

### 1.2 비회원 인증번호 확인 (로그인)

**Endpoint:** `POST /auth/verify-code`

**Request:**

```json
{
  "phone_number": "+821012345678",
  "code": "123456"
}
```

**Response:**

```json
{
  "success": true,
  "access_token": "JWT_TOKEN_HERE",
  "token_type": "bearer",
  "user": {
    "id": "uuid-user-123",
    "role": "client",
    "name": "홍길동"
  }
}
```

---

### 1.3 관리자/기사 로그인

**Endpoint:** `POST /auth/login`

**Request:**

```json
{
  "email": "inspector@nearcar.com",
  "password": "password123"
}
```

---

## 2. 공통/참조 API (Common)

차량 선택 드롭다운 및 지역 선택을 위한 메타 데이터 조회

### 2.1 제조사 목록 조회

**Endpoint:** `GET /common/vehicles/manufacturers`

**Query Params:**
- `origin` (domestic | imported)

**Response:**

```json
{
  "success": true,
  "data": [
    {"id": "man-001", "name": "현대"},
    {"id": "man-002", "name": "기아"},
    {"id": "man-003", "name": "제네시스"}
  ]
}
```

---

### 2.2 모델 목록 조회

**Endpoint:** `GET /common/vehicles/models`

**Query Params:**
- `manufacturer_id`

**Response:**

```json
{
  "success": true,
  "data": [
    {"id": "grp-001", "name": "그랜저"},
    {"id": "grp-002", "name": "쏘나타"}
  ]
}
```

---

### 2.3 상세 모델 조회 (Class 정보 포함)

**Endpoint:** `GET /common/vehicles/details`

**Query Params:**
- `model_group_id`

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "master-uuid-001",
      "name": "그랜저 IG (16~19년)",
      "vehicle_class": "large",
      "years": [2016, 2017, 2018, 2019]
    }
  ]
}
```

---

### 2.4 서비스 지역 조회

**Endpoint:** `GET /common/regions`

**Response:**

```json
{
  "success": true,
  "data": [
    {"id": "reg-001", "province": "서울", "city": "강남구", "extra_fee": 0},
    {"id": "reg-002", "province": "경기", "city": "가평군", "extra_fee": 20000}
  ]
}
```

---

## 3. 고객 API (Client)

### 3.1 차량 번호 조회 (국토부 API 연동)

**Endpoint:** `GET /client/vehicle/lookup`

**Query Params:**
- `plate_number`

**Response:**

```json
{
  "success": true,
  "data": {
    "plate_number": "12가3456",
    "model_name": "더 뉴 그랜저",
    "year": 2020,
    "fuel": "Gasoline",
    "manufacturer": "Hyundai"
  }
}
```

---

### 3.2 견적 산출 (Dynamic Pricing)

**Endpoint:** `POST /client/estimate`

**Request:**

```json
{
  "vehicle_master_id": "master-uuid-001",
  "region_id": "reg-002",
  "package_id": "pkg-basic"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "base_price": 55000,
    "class_surcharge": 10000, 
    "region_fee": 20000,
    "total_amount": 85000,
    "vehicle_class": "large"
  }
}
```

> **참고:** `vehicle_class`는 대형차 할증이 적용되었음을 나타냅니다.

---

### 3.3 진단 신청 (Apply)

**Endpoint:** `POST /client/inspections`

**Request:**

```json
{
  "vehicle_master_id": "master-uuid-001",
  "plate_number": "12가3456",
  "year": 2020,
  "mileage": 45000,
  "location_address": "서울시 강남구 역삼동...",
  "region_id": "reg-001",
  "preferred_schedule": "2025-12-03T10:00:00",
  "package_id": "pkg-basic",
  "payment_method": "card",
  "total_amount": 85000
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "inspection_id": "insp-123",
    "status": "requested"
  }
}
```

---

### 3.4 신청 상태 및 레포트 조회

**Endpoint:** `GET /client/inspections/{id}`

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "report_sent",
    "inspector": {"name": "김기사", "phone": "010-xxxx-xxxx"},
    "vehicle_info": "그랜저 IG (12가3456)",
    "report_summary": {
      "result": "good",
      "pdf_url": "https://s3.aws.com/reports/123.pdf",
      "web_view_url": "/report/view/123"
    }
  }
}
```

---

## 4. 기사 API (Inspector)

### 4.1 배정 대기 목록 조회

**Endpoint:** `GET /inspector/assignments`

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "insp-123",
      "location": "서울 강남구",
      "vehicle": "BMW 520d",
      "schedule": "2025-12-03 14:00",
      "fee": 45000
    }
  ]
}
```

> **참고:** `fee`는 기사의 예상 수익을 나타냅니다.

---

### 4.2 배정 수락/거절

**배정 수락:**

`POST /inspector/assignments/{id}/accept`

**배정 거절:**

`POST /inspector/assignments/{id}/reject`

**Request Body (거절 시):**

```json
{
  "reason": "일정 충돌"
}
```

---

### 4.3 레포트 작성 (이미지 업로드 포함)

**Endpoint:** `POST /inspector/reports/{id}/submit`

**Request:**

```json
{
  "checklist_data": {
    "engine_oil": "leak",
    "tire_wear": "normal"
  },
  "images": [
    {"section": "front", "url": "https://s3.../img1.jpg"},
    {"section": "engine", "url": "https://s3.../img2.jpg"}
  ],
  "inspector_comment": "엔진 오일 누유가 미세하게 있어 수리 요망",
  "repair_cost_estimate": 150000
}
```

---

## 5. 운영자 API (Admin)

### 5.1 차량 마스터 데이터 관리

**Endpoint:** `POST /admin/vehicles/master`

> 스크래핑 데이터 적재

**Request:**

```json
{
  "origin": "domestic",
  "manufacturer": "Hyundai",
  "model_group": "Grandeur",
  "model_detail": "The New Grandeur",
  "vehicle_class": "large",
  "start_year": 2019
}
```

> **참고:** `vehicle_class` 값에 따라 가격 정책이 연결됩니다.

---

### 5.2 가격 정책 설정

**Endpoint:** `POST /admin/prices`

**Request:**

```json
{
  "origin": "imported",
  "vehicle_class": "supercar",
  "add_amount": 100000
}
```

> **예시:** 수입 슈퍼카는 10만원 추가

---

### 5.3 신청 관리 및 강제 배정

**신청 목록 조회:**

`GET /admin/inspections`

**Query Params:**
- `status` (필터)
- `date` (필터)
- `region` (필터)

**강제 배정:**

`POST /admin/inspections/{id}/assign`

**Request:**

```json
{
  "inspector_id": "user-insp-005"
}
```

---

### 5.4 정산 집계

**Endpoint:** `POST /admin/settlements/calculate`

**Request:**

```json
{
  "target_date": "2025-12-04"
}
```

> **참고:** 해당 일자 완료 건에 대한 정산 집계를 실행합니다.

---

## 6. 공통 규칙 및 에러 처리

### Response Wrapper

모든 응답은 다음 형식을 따릅니다:

```json
{
  "success": boolean,
  "data": any,
  "error": {
    "code": "string",
    "msg": "string"
  }
}
```

---

### HTTP Status Codes

| Code | 설명 |
|------|------|
| 200 | OK |
| 400 | Bad Request (파라미터 오류, Pydantic Validation Fail) |
| 401 | Unauthorized (토큰 만료/없음) |
| 403 | Forbidden (권한 부족 - 예: 고객이 관리자 API 호출) |
| 404 | Not Found (리소스 없음) |
| 503 | Service Unavailable (국토부 API 연동 실패 등) |

---

### Pagination

리스트 조회 시 다음 파라미터를 기본 지원합니다:

- `?page=1&limit=20`