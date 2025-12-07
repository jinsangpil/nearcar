# NearCar Backend

## 서버 관리 스크립트

`server.sh` 스크립트를 사용하여 서버를 쉽게 관리할 수 있습니다.

### 사용법

```bash
# 서버 시작 (포트가 사용 중이면 기존 프로세스 종료 후 시작)
./server.sh start

# 서버 정지
./server.sh stop

# 서버 재시작
./server.sh restart

# 서버 상태 확인
./server.sh status
```

### 기능

- **start**: 서버 시작
  - 포트 8000이 사용 중이면 기존 프로세스를 자동으로 종료하고 새로 시작
  - PID 파일과 로그 파일 자동 관리
  - 시작 성공 여부 확인 및 상태 출력

- **stop**: 서버 정지
  - 정상 종료 시도 후 강제 종료
  - 포트를 사용하는 모든 프로세스 종료
  - PID 파일 정리

- **restart**: 서버 재시작
  - 기존 서버 정지 후 새로 시작

- **status**: 서버 상태 확인
  - 프로세스 실행 여부
  - 포트 사용 상태
  - HTTP 헬스 체크
  - 최근 로그 확인

### 수동 실행 방법

스크립트를 사용하지 않고 직접 실행하려면:

```bash
# 가상환경 활성화
source venv/bin/activate

# 또는 직접 Python 실행
./venv/bin/python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. 환경 변수 설정

`.env.local` 파일을 생성하고 필요한 환경 변수를 설정하세요.

### 3. API 문서 확인

서버 실행 후 다음 URL에서 API 문서를 확인할 수 있습니다:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 문제 해결

### uvicorn 명령어를 찾을 수 없는 경우

가상환경이 활성화되지 않았을 수 있습니다. 다음 명령어로 확인하세요:

```bash
# 가상환경의 Python 사용
./venv/bin/python -m uvicorn app.main:app --reload
```

### Python 3.13 호환성 문제

일부 패키지가 Python 3.13과 호환되지 않을 수 있습니다. Python 3.11 또는 3.12 사용을 권장합니다.

