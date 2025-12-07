# 니어카 통합 플랫폼 — 기술 사양서(TRD)

본 문서는 제품 요구사항 정의서(PRD)를 바탕으로 실제 개발 구현을 위한 기술 구조, 아키텍처, DB 스키마, API 정의, 인프라 구성 등을 상세히 기술한다. 특히 **차량 마스터 데이터(제조사/모델/등급) 관리 및 필터링 기능**이 강화되었다.

---

# 1. 기술 스택 개요

## 1.1 프론트엔드
- **Framework**: React + Next.js (SSR 및 SEO 최적화, 빠른 로딩 속도)
- **Language**: TypeScript (정적 타입 지원)
- **State Management**: Zustand (전역 상태), React Query (서버 상태 동기화 및 캐싱)
- **UI Framework**: TailwindCSS

## 1.2 백엔드
- **Framework**: Python + FastAPI (비동기 처리 최적화, 고성능)
- **Validation**: Pydantic (엄격한 데이터 검증)
- **Async Task**: Celery + Redis (알림 발송, 리포트 PDF 생성, 외부 API 연동 등 비동기 작업)

## 1.3 데이터베이스
- **PostgreSQL**: 메인 관계형 DB (사용자, 예약, 결제, **차량 마스터 정보**)
- **Redis**: In-memory 저장소 (사용자 세션, 차량 모델 리스트 API 캐싱)

## 1.4 외부 인터페이스
- **국토교통부 API**: 차량 번호 기반 기본 제원 조회 (차명, 제원, 연식 등)
- **Car365 API**: 실매물 조회 및 침수 이력 확인

## 1.5 인프라
- **Cloud**: AWS (EC2/ECS) 또는 GCP
- **Storage**: AWS S3 (이미지, 영상, PDF 리포트 파일 저장)
- **CDN**: CloudFront (정적 자원 로딩 최적화)
- **Notification**: 카카오 알림톡(BizTalk), SMS(Twilio/NHN), SMTP(AWS SES)

---

# 2. 시스템 아키텍처

```mermaid
graph TD
    User[User Client] -->|HTTPS| CDN[CloudFront]
    CDN --> FE[Next.js Frontend]
    FE -->|API Request| BE[FastAPI Backend]
    
    subgraph Backend Services
    BE --> DB[(PostgreSQL)]
    BE --> Redis[(Redis Cache)]
    BE --> Worker[Celery Worker]
    end
    
    subgraph External APIs
    Worker --> MOLIT[국토교통부 API]
    Worker --> Car365[Car365 API]
    end
    
    subgraph Storage & Msg
    BE --> S3[S3 Bucket]
    Worker --> S3
    Worker --> AlimTalk[Kakao AlimTalk]
    end

# 3. 데이터 모델 정의 (DB Schema)

**핵심 사항**: 차량 선택 필터 및 가격 산정 기준이 되는 `vehicle_master` 테이블이 신설됨.

## 3.1 users (사용자)
| 필드 | 타입 | 설명 |
|---|---|---|
| id | UUID | PK |
| role | ENUM | client, inspector, staff, admin |
| name | VARCHAR | 이름 |
| phone | VARCHAR | 전화번호(암호화 저장) |
| region_id | FK(service_regions) | 기사 활동 지역 |
| level | INT | 기사 등급 |
| commission_rate | FLOAT | 기사별 수수료율 (시스템 기본값 오버라이드용) |
| created_at | TIMESTAMP | 계정 생성일 |

## 3.2 vehicle_master (차량 마스터 데이터 - New)
*차량 선택 필터(Select Box) 구성 및 등급/금액 판정의 기준이 되는 메타 데이터*

| 필드 | 타입 | 설명 |
|---|---|---|
| id | UUID | PK |
| origin | ENUM | domestic(국산), imported(해외) |
| manufacturer | VARCHAR | 제조사 (현대, 기아, BMW, 벤츠 등) |
| model_group | VARCHAR | 모델명 (그랜저, E클래스, 5시리즈) |
| model_detail | VARCHAR | 상세모델 (더 뉴 그랜저 IG, E-Class W213) |
| vehicle_class | ENUM | compact(경차), small, mid, large, sports, suv, supercar... |
| start_year | INT | 출시년도 |
| end_year | INT | 단종년도 (생산중이면 Null) |
| is_active | BOOLEAN | 필터 노출 여부 |

## 3.3 vehicles (고객/진단 대상 차량)
| 필드 | 타입 | 설명 |
|---|---|---|
| id | UUID | PK |
| user_id | FK(users) | 소유주/신청자 |
| master_id | FK(vehicle_master) | **차량 마스터 매핑 (표준화된 모델 정보)** |
| plate_number | VARCHAR | 차량번호 |
| owner_change_count | INT | 소유자 변경 횟수 |
| production_year | INT | 연식 |
| fuel_type | VARCHAR | 연료 |
| is_flooded | BOOLEAN | 침수 여부 (Car365 조회 결과) |

## 3.4 packages (패키지 관리)
| 필드 | 타입 | 설명 |
|---|---|---|
| id | UUID | PK |
| name | VARCHAR | 패키지명 (풀패키지, 라이트A 등) |
| base_price | INT | 기본 가격 |
| is_active | BOOLEAN | 활성화 여부 |
| included_items | JSONB | 포함된 진단 항목 리스트 |

## 3.5 price_policies (차종별 금액 정책)
*차량 등급(Class)에 따른 추가 요금 관리 테이블*

| 필드 | 타입 | 설명 |
|---|---|---|
| id | UUID | PK |
| origin | ENUM | domestic, imported (국산/수입 구분) |
| vehicle_class | ENUM | `vehicle_master`의 vehicle_class와 매핑 (소형, 중형...) |
| add_amount | INT | 기본 패키지 가격에 추가되는 할증 금액 |

## 3.6 service_regions (서비스 지역 관리)
| 필드 | 타입 | 설명 |
|---|---|---|
| id | UUID | PK |
| province | VARCHAR | 도/광역시 (경기, 서울) |
| city | VARCHAR | 시/구 (강남구, 분당구) |
| extra_fee | INT | 지역 할증 요금 |
| is_active | BOOLEAN | 서비스 가능 여부 |

## 3.7 inspections (진단 신청)
| 필드 | 타입 | 설명 |
|---|---|---|
| id | UUID | PK |
| user_id | FK(users) | 고객 |
| inspector_id | FK(users) | 배정 기사 |
| vehicle_id | FK(vehicles) | 대상 차량 |
| package_id | FK(packages) | 선택 패키지 |
| purchase_type | ENUM | dealer, direct, home |
| status | ENUM | requested, assigned, report_sent, completed, cancelled |
| schedule_date | DATE | 예약 날짜 |
| schedule_time | TIME | 예약 시간 |
| total_amount | INT | 최종 결제 금액 |

## 3.8 inspection_reports (레포트)
| 필드 | 타입 | 설명 |
|---|---|---|
| id | UUID | PK |
| inspection_id | FK | |
| checklist_data | JSONB | 항목별 진단 결과 Key-Value |
| inspector_comment | TEXT | 기사 종합 의견 |
| images | JSONB | 부위별 사진 URL 리스트 |
| report_pdf_url | VARCHAR | PDF 파일 링크 |
| status | ENUM | submitted, reviewed |

## 3.9 settlements (정산)
| 필드 | 타입 | 설명 |
|---|---|---|
| id | UUID | PK |
| inspector_id | FK | 기사 ID |
| total_sales | INT | 기간 내 총 매출액 |
| fee_rate | FLOAT | 적용 수수료율 |
| settle_amount | INT | 최종 지급액 |
| status | ENUM | pending, completed |


# 4. API 설계 상세

## 4.1 공통/참조 데이터 (Reference Data) - New
*프론트엔드 필터링(Select Box)을 위한 계층형 데이터 제공*

- `GET /api/vehicles/manufacturers`: 제조사 목록 조회 (Query: origin=domestic/imported)
- `GET /api/vehicles/models`: 모델 목록 조회 (Query: manufacturer_id)
- `GET /api/vehicles/details`: 상세 모델 조회 (Query: model_group_id)
- `GET /api/regions`: 서비스 가능 지역 및 추가 요금 조회

## 4.2 고객 (Client)
- `POST /auth/login`: 로그인 및 인증 요청
- `POST /inspections/estimate`: **견적 산출** (차량 마스터 정보 + 지역 + 패키지 조합하여 금액 계산)
- `POST /inspections`: 진단 신청 및 결제
- `GET /inspections/{id}`: 신청 상태 및 상세 내역 확인
- `GET /reports/{inspection_id}`: 완료된 레포트 열람

## 4.3 진단기사 (Inspector)
- `GET /inspector/assignments`: 배정 요청 목록 조회
- `POST /inspector/assignments/{id}/accept`: 배정 수락
- `POST /inspector/assignments/{id}/reject`: 배정 거절 (사유 입력)
- `POST /inspector/reports/submit`: 레포트 작성 및 제출
- `GET /inspector/settlements`: 정산 내역 및 상태 조회

## 4.4 운영자 (Admin) - 차량 관리 강화
- **차량 마스터 관리 (Vehicle Master)**
    - `POST /admin/vehicles/master`: 신규 차량 모델 등록 (스크래핑 데이터 적재용)
    - `PUT /admin/vehicles/master/{id}`: 모델 정보 수정 (등급, 클래스 재조정)
    - `GET /admin/vehicles/master`: 차량 데이터 검색 및 조회
- **설정 관리**
    - `POST /admin/prices`: 차종별(Class별) 금액 정책 설정
    - `POST /admin/regions`: 지역 설정 및 할증 관리
- **운영 관리**
    - `POST /admin/inspections/{id}/assign`: 기사 수동 배정
    - `POST /admin/settlements/calculate`: 정산 집계 실행

---

# 5. 주요 비즈니스 로직

## 5.1 차량 필터 및 데이터 적재 로직
1. **데이터 구축**: 초기 구축 시 외부 DB(카탈로그) 또는 스크래핑을 통해 `vehicle_master` 테이블에 [국산/수입 > 제조사 > 모델 > 상세모델 > 연식] 계층 데이터를 적재한다.
2. **사용자 입력 흐름**: 고객이 진단 신청 시, Select Box를 통해 `제조사` -> `모델` -> `상세모델` 순으로 선택하게 한다.
3. **자동 매핑 및 계산**: 선택된 상세모델의 `vehicle_class`(예: 준대형, 슈퍼카) 정보를 바탕으로 `price_policies` 테이블을 참조하여 추가 요금을 자동 계산한다.

## 5.2 배정 로직 (V1: 수동/반자동 -> V2: 자동)
1. **신청 접수**: 고객 결제 완료 시 상태 `requested`.
2. **후보 추출**: 
   - 거리 30km 이내
   - 희망시간 ±2시간 매칭
   - **해당 차량 클래스(예: 슈퍼카) 진단 가능 자격**을 가진 기사만 필터링.
3. **배정 실행**: 우선순위 알고리즘에 따라 기사에게 알림 발송 (V1에서는 운영자가 리스트 보고 수동 지정).

---

# 6. 비기능 요구사항 (NFR)

## 6.1 성능 및 안정성
- **캐싱 전략**: `vehicle_master` 데이터와 같이 변경이 잦지 않고 조회가 빈번한 데이터는 Redis에 캐싱하여 필터 로딩 속도를 100ms 이내로 최적화한다.
- **보고서 처리**: PDF 생성은 비동기 큐(Celery)로 처리하여 사용자의 대기 시간을 최소화한다.

## 6.2 보안
- **개인정보**: 이름, 연락처, 상세 주소 등 민감 정보는 DB 저장 시 AES-256 알고리즘으로 암호화한다.
- **API 보안**: JWT Access Token을 사용하며, SSL(HTTPS) 통신을 강제한다.