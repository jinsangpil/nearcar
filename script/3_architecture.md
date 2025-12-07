# Architecture - 니어카

본 문서는 니어카(NearCar) 통합 플랫폼의 전체 시스템 아키텍처를 정의합니다.

업데이트된 TRD(차량 마스터 데이터, 외부 API 연동 등)를 반영하였으며, Docker 컨테이너를 사용하지 않고 Linux 호스트(VM/Bare-metal)에 직접 배포하는 환경을 기준으로 설계되었습니다.

---

## 1. 전체 구조 개요 (High-Level Architecture)

니어카는 **단일 서버(Scale-up 전략)**에서 효율적으로 동작하도록 설계되었습니다. 복잡한 컨테이너 오케스트레이션 없이, 검증된 Linux 데몬(systemd)과 프로세스 매니저를 활용해 안정성을 확보합니다.

```mermaid
graph TD
    User[Client (Mobile/PC)] -->|HTTPS| CF[Cloudflare (DNS/CDN/WAF)]
    CF --> Nginx[Nginx (Reverse Proxy)]
    
    subgraph "Application Server (Ubuntu 22.04 LTS)"
        Nginx -->|Proxy_Pass| FastAPI[FastAPI (Systemd Service)]
        FastAPI -->|DB Query| PG[(PostgreSQL 15)]
        FastAPI -->|Cache/Broker| Redis[(Redis)]
        
        subgraph "Async Worker"
            Celery[Celery Worker (Systemd Service)] -->|Task| Redis
            Celery -->|Data Sync| MOLIT[국토부 API]
            Celery -->|History| Car365[Car365 API]
        end
    end
    
    FastAPI -->|Upload| S3[AWS S3]
    Celery -->|Report PDF| S3
    Celery -->|Notification| AlimTalk[Kakao BizMsg]
```


---

## 2. 기술 스택 및 버전 (Non-Docker)

### 2.1 프론트엔드 (Node.js Environment)

- **Framework:** Next.js 14+ (App Router)
- **Runtime:** Node.js 20 LTS (호스트 직접 설치)
- **Build:** Static Build 후 Nginx 서빙 또는 `next start` 포트 포워딩
- **State:** Zustand (전역), TanStack Query (서버 상태)

### 2.2 백엔드 (Python Environment)

- **Framework:** FastAPI (ASGI)
- **Runtime:** Python 3.11+ (venv 가상환경 필수 사용)
- **Process Manager:** systemd + Gunicorn (Process Manager) + Uvicorn (Worker Class)
- **Async Queue:** Celery 5+ (외부 API 연동 및 PDF 생성용)

### 2.3 데이터베이스 & 캐시 (Local Installation)

- **RDBMS:** PostgreSQL 15+ (`apt install postgresql`)
- **NoSQL:** Redis 7+ (`apt install redis-server`) - 세션, 캐시, Celery Broker 겸용

### 2.4 웹 서버 & 프록시

- **Server:** Nginx (Mainline/Stable)
- **Role:** SSL Termination, Gzip 압축, 정적 파일 캐싱, 로드 밸런싱

---

## 3. 주요 구성 요소 상세

### 3.1 Nginx (Reverse Proxy)

FastAPI 앞단에서 문지기 역할을 수행합니다. Docker가 없으므로 `/etc/nginx/sites-available/` 설정을 직접 관리합니다.

- **SSL 인증서:** Let's Encrypt (Certbot) 자동 갱신 적용
- **Client Body Limit:** 이미지/영상 업로드를 위해 `client_max_body_size 50M` 설정
- **Timeouts:** 외부 API 지연을 고려해 `proxy_read_timeout 60s` 설정

### 3.2 FastAPI (Backend App)

- **가상환경(venv):** `/var/www/nearcar/backend/venv` 경로에 독립된 파이썬 환경 구축
- **동작 방식:** systemd 서비스로 등록되어, 서버 재부팅 시 자동 실행(enable) 및 실패 시 자동 재시작(restart)
- **확장성:** CPU 코어 수에 맞춰 Gunicorn Worker 프로세스 수 조정 (예: 2 × Cores + 1)

### 3.3 Celery (비동기 워커)

사용자 응답 속도(Latency)를 저하시키지 않기 위해 무거운 작업은 백그라운드로 처리합니다.

- **국토부/Car365 API:** 차량 정보 조회 시 응답 대기 시간이 길 수 있으므로 비동기 처리 권장
- **PDF 생성:** 리포트 제출 시 PDF 변환 작업 수행
- **알림 발송:** 카카오 알림톡 전송

### 3.4 PostgreSQL (DB)

- **설치:** 호스트 OS에 직접 설치 및 `systemctl`로 관리
- **백업:** `pg_dump`를 이용한 일일 자동 백업 스크립트(cron) 작성 → S3로 전송
- **보안:** `pg_hba.conf` 설정을 통해 외부 접속 차단(Localhost only) 또는 특정 IP만 허용

---

## 4. 외부 인터페이스 연동 구조

### 4.1 국토교통부 & Car365 API

- **호출 주체:** FastAPI 메인 스레드가 아닌 Celery Worker가 수행
- **장애 대응:** 외부 API 타임아웃/에러 발생 시, Retry 정책(Exponential Backoff) 적용
- **캐싱:** 동일 차량 번호 조회 시 API 호출 비용 절감을 위해 Redis에 24시간 캐싱

### 4.2 파일 스토리지 (AWS S3)

서버 디스크 용량 한계를 극복하기 위해 미디어 파일은 S3에 저장.

**업로드 흐름:**

1. 클라이언트 → 백엔드: "업로드 할게요" 요청
2. 백엔드 → 클라이언트: Presigned URL 발급
3. 클라이언트 → S3: 직접 업로드 (서버 부하 감소)

---

## 5. 서버 디렉토리 및 관리 구조 (표준안)

Docker를 사용하지 않으므로 파일 시스템 구조를 명확히 정의해야 유지보수가 용이합니다.

### 5.1 디렉토리 구조

```
/var/www/nearcar/
├── frontend/          # Next.js 빌드 파일 및 소스
│   ├── .next/
│   ├── public/
│   └── package.json
├── backend/           # FastAPI 소스 및 가상환경
│   ├── venv/          # Python Virtual Environment (Isolation)
│   ├── app/           # Source Code
│   ├── requirements.txt
│   └── .env           # 환경변수 (DB 접속정보, API Key 등)
└── logs/              # 어플리케이션 로그
    ├── nginx/
    ├── gunicorn/
    └── celery/
```

---

### 5.2 Systemd 서비스 설정 (프로세스 관리)

리눅스 기본 프로세스 관리자인 systemd를 사용하여 서비스를 관리합니다.

**A. 백엔드 서비스** (`/etc/systemd/system/nearcar-api.service`)

```ini
[Unit]
Description=Gunicorn instance to serve NearCar API
After=network.target

[Service]
User=ubuntu
Group=www-data
WorkingDirectory=/var/www/nearcar/backend
Environment="PATH=/var/www/nearcar/backend/venv/bin"
EnvironmentFile=/var/www/nearcar/backend/.env
ExecStart=/var/www/nearcar/backend/venv/bin/gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 127.0.0.1:8000

[Install]
WantedBy=multi-user.target
```

**B. 워커 서비스** (`/etc/systemd/system/nearcar-worker.service`)

```ini
[Unit]
Description=Celery Worker for NearCar
After=network.target redis.service

[Service]
User=ubuntu
WorkingDirectory=/var/www/nearcar/backend
Environment="PATH=/var/www/nearcar/backend/venv/bin"
EnvironmentFile=/var/www/nearcar/backend/.env
ExecStart=/var/www/nearcar/backend/venv/bin/celery -A app.worker worker --loglevel=info

[Install]
WantedBy=multi-user.target
```


---

## 6. 네트워크 및 보안 설계

### 6.1 트래픽 흐름

```
[Internet]
    ↓ (Port 443)
[Cloudflare] (DDOS 방어, SSL 1차 처리)
    ↓
[Host: Nginx] (SSL Termination, Header 정리)
    ↓ (Proxy Pass: localhost:8000 / localhost:3000)
[Host: Python/Node] (Application Logic)
    ↓ (localhost:5432 / localhost:6379)
[Host: DB/Redis]
```

---

### 6.2 보안 조치

- **방화벽(UFW):** Inbound는 Nginx(80, 443)와 SSH(22 - 특정 IP 제한 권장)만 허용. DB 포트(5432)는 외부 차단
- **환경변수:** `.env` 파일은 `chmod 600`으로 소유자만 읽을 수 있도록 설정
- **SSH:** 비밀번호 접속 비활성화(`PasswordAuthentication no`), SSH Key 기반 접속만 허용

---

## 7. 배포 파이프라인 (CI/CD - Non-Docker)

Docker 이미지를 교체하는 방식이 아니므로, Git Pull 및 서비스 재시작 방식을 사용합니다.

### GitHub Actions Workflow 예시

**1. Source Check:** `main` 브랜치 Push 감지

**2. Transfer:** SSH를 통해 운영 서버 접속

**3. Backend Update:**

```bash
cd /var/www/nearcar/backend
git pull origin main
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart nearcar-api
sudo systemctl restart nearcar-worker
```

**4. Frontend Update:**

```bash
cd /var/www/nearcar/frontend
git pull origin main
npm install
npm run build
# PM2 또는 Systemd로 관리되는 Next.js 재시작
pm2 reload nearcar-web
```

**5. Nginx Reload:** (설정 변경 시에만)

```bash
sudo systemctl reload nginx
```

---

## 8. 인프라 확장 전략 (Roadmap)

V1은 단일 서버(Monolithic Deployment)로 시작하지만, 트래픽 증가에 대비한 확장 시나리오는 다음과 같습니다.

| Phase | 설명 |
|-------|------|
| **Phase 1** (현재) | All-in-One Server (Web + App + DB) |
| **Phase 2** (DB 분리) | DB 부하 증가 시, AWS RDS 또는 별도 DB 서버로 PostgreSQL 분리 |
| **Phase 3** (서버 증설) | API 요청량 증가 시, Load Balancer를 앞단에 두고 App Server(EC2)를 수평 확장(Auto Scaling). 이때 Nginx는 LB 역할을 수행하거나 AWS ELB로 대체 |
| **Phase 4** (스토리지) | 로컬 파일 시스템 의존성을 완전히 제거하고 모든 정적 자원 S3 + CloudFront 처리 |

---

## 9. 결론

### Simple is Best
Docker 오버헤드와 복잡성을 제거하여, 초기 개발 속도와 디버깅 용이성을 확보했습니다.

### Native Performance
호스트 자원을 직접 사용하여 I/O 성능 손실을 최소화했습니다.

### Management
systemd와 git이라는 가장 기본적이고 강력한 도구로 전체 수명 주기를 관리합니다.