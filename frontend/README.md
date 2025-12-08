# 니어카 관리자 프론트엔드

Next.js 14+ 기반의 운영자 관리 시스템입니다.

## 기술 스택

- **프레임워크**: Next.js 15+ (App Router)
- **언어**: TypeScript
- **스타일링**: TailwindCSS
- **상태 관리**: Zustand
- **데이터 페칭**: TanStack Query
- **테이블**: TanStack Table 8.0+
- **차트**: Chart.js 4.0+ (react-chartjs-2)
- **HTTP 클라이언트**: Axios

## 시작하기

### 환경 변수 설정

`.env.local` 파일을 생성하고 다음 변수를 설정하세요:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 개발 서버 실행

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

### 빌드

```bash
npm run build
npm start
```

## 프로젝트 구조

```
frontend/
├── app/                    # Next.js App Router
│   ├── (admin)/           # 관리자 전용 라우트 그룹
│   │   ├── layout.tsx      # 관리자 레이아웃
│   │   ├── dashboard/      # 대시보드
│   │   ├── inspections/    # 신청 관리
│   │   └── reports/        # 레포트 검수
│   ├── layout.tsx          # 루트 레이아웃
│   └── globals.css         # 전역 스타일
├── components/
│   ├── admin/             # 관리자 전용 컴포넌트
│   ├── common/            # 공통 컴포넌트
│   └── ui/                # UI 컴포넌트
├── lib/
│   ├── api/               # API 클라이언트
│   ├── hooks/             # 커스텀 훅
│   ├── providers/         # Context Providers
│   └── utils/             # 유틸리티 함수
├── stores/                # Zustand 스토어
└── types/                 # TypeScript 타입 정의
```

## 주요 기능

### 1. 대시보드
- 주요 지표 카드 (신규 신청, 미배정, 진행 중, 완료)
- 일별/주별 신청 추이 차트
- 30초 간격 자동 새로고침

### 2. 신청 관리
- 신청 목록 테이블 (TanStack Table)
- 필터링 (상태, 지역, 날짜)
- 정렬 및 페이지네이션
- 로컬 스토리지에 필터/정렬 설정 저장

### 3. 신청 상세
- 차량/고객/결제 정보 표시
- 상태 변경 기능
- 기사 배정 링크

### 4. 기사 배정
- 가용 기사 목록 조회
- 거리/평점 기준 정렬
- 기사 선택 및 배정

### 5. 레포트 검수
- 제출된 레포트 목록 조회
- 레포트 상세 확인 (체크리스트, 이미지, 코멘트)
- 승인/반려 기능
- 피드백 입력

## 인증

관리자/직원 권한이 필요합니다. 로그인 페이지는 `/login`에서 접근할 수 있습니다.

## API 연동

모든 API 호출은 `lib/api/client.ts`의 Axios 인스턴스를 통해 이루어집니다. 인증 토큰은 자동으로 헤더에 추가됩니다.

## 참고사항

- 백엔드 서버가 `http://localhost:8000`에서 실행 중이어야 합니다.
- 관리자 계정이 필요합니다 (백엔드에서 생성).

