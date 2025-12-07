Core Logic Sequence Diagrams - 니어카

본 문서는 니어카 시스템의 핵심 비즈니스 로직 흐름을 정의합니다.
API Spec 및 TRD를 기준으로 작성되었습니다.

1. 차량 조회 및 동적 견적 (Vehicle Lookup & Estimate)

핵심 포인트: 국토부 API 장애 시 예외 처리, 마스터 데이터 매핑을 통한 등급(Class) 판별, 지역+등급에 따른 가격 합산 로직.

sequenceDiagram
    autonumber
    actor User as Client
    participant FE as Frontend (Next.js)
    participant BE as Backend (FastAPI)
    participant Redis as Redis Cache
    participant Ext as External API (MOLIT/Car365)
    participant DB as PostgreSQL

    Note over User, FE: Step 1: 차량 번호 조회
    User->>FE: 차량번호 입력 (12가3456)
    FE->>BE: GET /client/vehicle/lookup?plate_number=...
    
    BE->>Redis: 캐시 조회 (Key: vehicle:12가3456)
    alt Cache Hit
        Redis-->>BE: 차량 기본 정보 반환
    else Cache Miss
        BE->>Ext: 국토부 API 호출 (제원 조회)
        alt API Success
            Ext-->>BE: 차량 데이터 (모델명, 연식 등)
            BE->>Redis: 데이터 캐싱 (TTL 24h)
        else API Failure / Timeout
            BE-->>FE: 404 Not Found (직접 입력 유도)
        end
    end

    BE->>DB: Vehicle Master 매핑 조회 (모델명 매칭)
    DB-->>BE: Master ID, Vehicle Class (예: Large) 반환
    BE-->>FE: 차량 정보 + Master Data 응답

    Note over User, FE: Step 2: 견적 산출
    User->>FE: 지역 선택 (제주) + 패키지 선택 (Basic)
    FE->>BE: POST /client/estimate (master_id, region_id, package_id)
    
    BE->>DB: 가격 정책 조회 (Price Policies)
    DB-->>BE: 기본료(5.5) + 등급할증(1.0) + 지역할증(5.0)
    
    BE->>BE: 총액 계산 (11.5만원)
    BE-->>FE: 최종 견적 금액 및 상세 내역 반환
    FE->>User: 견적서 UI 표시


2. 진단 신청 및 결제 (Application & Payment)

핵심 포인트: PG사 결제 승인 후 서버 검증, 트랜잭션 보장, 알림톡 발송 트리거.

sequenceDiagram
    autonumber
    actor User as Client
    participant FE as Frontend
    participant PG as PG사 (Toss/Iamport)
    participant BE as Backend
    participant DB as PostgreSQL
    participant Worker as Celery Worker

    User->>FE: "결제하기" 버튼 클릭
    FE->>PG: 결제 창 호출 (JS SDK)
    User->>PG: 카드 정보 입력 및 결제 수행
    PG-->>FE: 결제 성공 (imp_uid, merchant_uid)

    FE->>BE: POST /client/inspections (결제정보 + 신청데이터)
    
    rect rgb(240, 248, 255)
        note right of BE: 결제 검증 및 저장 트랜잭션
        BE->>PG: 결제 단건 조회 (Verify Amount)
        alt Amount Match
            PG-->>BE: 검증 성공
            BE->>DB: INSERT vehicles (차량정보)
            BE->>DB: INSERT inspections (상태: requested)
            BE->>DB: INSERT payments (상태: paid)
        else Amount Mismatch
            BE->>PG: 결제 취소 요청
            BE-->>FE: 400 Error (결제 위변조 감지)
        end
    end

    BE->>Worker: 알림 발송 Task 생성 (Async)
    BE-->>FE: 신청 완료 응답 (inspection_id)
    
    par Async Tasks
        Worker->>User: 카카오 알림톡 (신청 완료)
        Worker->>DB: 관리자용 알림 저장
    end

    FE->>User: 신청 완료 페이지 이동


3. 기사 배정 프로세스 (Inspector Assignment)

핵심 포인트: 관리자의 수동 배정 후 기사의 수락/거절 프로세스에 따른 상태 변화.

sequenceDiagram
    autonumber
    actor Admin as 운영자
    participant BE as Backend
    participant DB as PostgreSQL
    participant Worker as Celery Worker
    actor Inspector as 진단기사

    Note over Admin, BE: V1: 수동 배정 (Manual)
    Admin->>BE: GET /admin/inspections?status=requested
    BE->>DB: 미배정 건 조회
    DB-->>BE: 리스트 반환
    BE-->>Admin: 목록 표시

    Admin->>BE: POST /admin/inspections/{id}/assign (inspector_id)
    BE->>DB: UPDATE inspections SET status='assigned'
    BE->>Worker: 기사에게 알림 발송 Task
    Worker->>Inspector: 카카오 알림톡 ("새로운 배정 요청")

    Note over Inspector, BE: 기사 수락/거절
    Inspector->>BE: GET /inspector/assignments
    BE-->>Inspector: 배정 요청 건 상세 정보 (거리, 차종, 금액)

    alt 기사 수락
        Inspector->>BE: POST /accept
        BE->>DB: UPDATE inspections SET status='scheduled'
        BE->>Worker: 고객에게 해피콜 안내 알림
        Worker->>User: 알림톡 ("담당 기사가 배정되었습니다")
    else 기사 거절
        Inspector->>BE: POST /reject (사유 입력)
        BE->>DB: UPDATE inspections SET status='requested', inspector_id=NULL
        BE->>DB: INSERT logs (거절 이력)
        BE->>Worker: 운영자에게 재배정 요망 알림
    end


4. 레포트 제출 및 PDF 생성 (Report & PDF)

핵심 포인트: 대용량 이미지의 S3 직접 업로드(Presigned URL), PDF 생성의 비동기 처리(서버 부하 방지).

sequenceDiagram
    autonumber
    actor Inspector as 진단기사
    participant App as Inspector App
    participant BE as Backend
    participant S3 as AWS S3
    participant DB as PostgreSQL
    participant Worker as Celery Worker

    Note over Inspector, S3: 이미지 업로드 단계
    Inspector->>App: 진단 사진 촬영/선택
    loop For each image
        App->>BE: GET /common/upload-url (Presigned URL 요청)
        BE-->>App: Upload URL 반환
        App->>S3: PUT Image (Direct Upload)
    end

    Note over Inspector, BE: 레포트 데이터 제출
    Inspector->>App: 체크리스트 작성 및 제출
    App->>BE: POST /inspector/reports/{id}/submit (Data + Image Keys)
    
    BE->>DB: INSERT inspection_reports (status: submitted)
    BE->>DB: UPDATE inspections (status: report_submitted)
    BE->>Worker: PDF 생성 Task 전달 (inspection_id)
    BE-->>App: 제출 성공 응답

    Note over Worker, S3: 비동기 PDF 생성
    Worker->>DB: 레포트 데이터 조회
    Worker->>Worker: PDF Rendering (ReportLab/WeasyPrint)
    Worker->>S3: PDF 파일 업로드
    S3-->>Worker: PDF Public/Presigned URL
    Worker->>DB: UPDATE inspection_reports SET pdf_url=..., status='reviewed'
    
    opt Auto Send (정책에 따라 관리자 검토 후 발송일 수 있음)
        Worker->>User: 알림톡 (레포트가 도착했습니다 + URL)
    end
