# Celery Worker 실행 가이드

## 개요

NearCar 백엔드는 Celery를 사용하여 비동기 작업을 처리합니다:
- PDF 생성 (진단 레포트)
- 알림 발송 (알림톡, SMS, 이메일)

## 사전 요구사항

### 1. Redis 실행 확인

Celery는 Redis를 메시지 브로커로 사용합니다. Redis가 실행 중인지 확인하세요:

```bash
# Redis 실행 확인
redis-cli ping
# 응답: PONG

# 또는 Docker로 실행
docker run -d -p 6379:6379 redis:latest
```

### 2. WeasyPrint 시스템 라이브러리 설치 (PDF 생성용)

#### macOS (Homebrew)
```bash
brew install cairo pango gdk-pixbuf libffi
```

#### Ubuntu/Debian
```bash
sudo apt-get install build-essential python3-dev python3-pip python3-setuptools python3-wheel python3-cffi libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf2.0-0 libffi-dev shared-mime-info
```

#### CentOS/RHEL
```bash
sudo yum install cairo-devel pango-devel gdk-pixbuf2-devel libffi-devel
```

## Celery Worker 실행

### 방법 1: 실행 스크립트 사용 (권장)

```bash
cd backend
./celery_worker.sh
```

### 방법 2: 직접 실행

```bash
cd backend
source venv/bin/activate
celery -A app.core.celery_app worker --loglevel=info --concurrency=4
```

### 방법 3: 백그라운드 실행

```bash
cd backend
source venv/bin/activate
nohup celery -A app.core.celery_app worker --loglevel=info --concurrency=4 > celery.log 2>&1 &
```

## Celery Worker 옵션

- `--loglevel=info`: 로그 레벨 설정 (debug, info, warning, error)
- `--concurrency=4`: 동시 실행 가능한 작업 수
- `--pool=solo`: Windows 환경에서 사용 (기본값: prefork)
- `--beat`: Celery Beat 스케줄러 실행 (주기적 작업용)

## 모니터링

### Task 상태 확인

```bash
# Celery Flower 설치 (선택적)
pip install flower

# Flower 실행
celery -A app.core.celery_app flower
# 브라우저에서 http://localhost:5555 접속
```

### 로그 확인

```bash
# 실시간 로그 확인
tail -f celery.log

# 또는
celery -A app.core.celery_app events
```

## 문제 해결

### 1. Redis 연결 오류

```
Error: Error 111 connecting to localhost:6379. Connection refused.
```

**해결**: Redis가 실행 중인지 확인하고, `.env` 파일의 `REDIS_HOST`, `REDIS_PORT` 설정을 확인하세요.

### 2. WeasyPrint 라이브러리 오류

```
OSError: cannot load library 'libgobject-2.0-0'
```

**해결**: 위의 "WeasyPrint 시스템 라이브러리 설치" 섹션을 참고하여 시스템 라이브러리를 설치하세요.

### 3. Task가 실행되지 않음

- Celery Worker가 실행 중인지 확인
- Redis 연결 상태 확인
- 로그 파일에서 오류 메시지 확인

## 프로덕션 환경

프로덕션 환경에서는 systemd 또는 supervisor를 사용하여 Celery Worker를 관리하는 것을 권장합니다.

### systemd 예시

`/etc/systemd/system/celery-worker.service`:

```ini
[Unit]
Description=Celery Worker for NearCar
After=network.target redis.service

[Service]
Type=forking
User=www-data
Group=www-data
WorkingDirectory=/path/to/backend
Environment="PATH=/path/to/venv/bin"
ExecStart=/path/to/venv/bin/celery -A app.core.celery_app worker --loglevel=info --concurrency=4 --pidfile=/var/run/celery/worker.pid --logfile=/var/log/celery/worker.log
ExecStop=/bin/kill -s TERM $MAINPID
Restart=always

[Install]
WantedBy=multi-user.target
```

