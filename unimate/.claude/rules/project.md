# UniMate — 프로젝트 개요

> 한신대학교 재학생을 위한 AI 기반 학교생활 도우미 서비스
>
> 캡스톤 디자인 프로젝트 | 팀 2~3인

---

## 서비스 핵심 가치

| 문제 | 해결 |
| --- | --- |
| 흩어진 공지/학사정보 | 한 곳에 자동 수집 (크롤러) |
| 복잡한 일정 관리 | 학사일정 + 과제 + 개인일정 통합 |
| 수동 정보 검색 | AI Agent가 Tool을 선택해 자율 답변 |
| 놓치는 마감일 | FCM 푸시 알림 자동 발송 |

---

## 기술 스택

### Backend

- **FastAPI** (Python 3.11+) — 비동기, 자동 API 문서
- **PostgreSQL 15+** — 메인 DB (pgvector 확장 포함)
- **Redis** — 캐시 + Celery 브로커
- **Celery + Beat** — 크롤링 스케줄러 (07:00~18:00, 6회/일)
- **SQLAlchemy** (async, asyncpg) — ORM
- **Alembic** — DB 마이그레이션

### Frontend (Mobile)

- **React Native 0.81.5 + Expo SDK 54** — 크로스 플랫폼 앱
- **Expo Router v6** — 파일 기반 라우팅
- **Zustand v5** — 전역 상태 관리 (authStore만 사용)
- **Axios v1** — API 통신 (요청/응답 인터셉터)
- **expo-secure-store** — Refresh Token 저장
- **react-native-safe-area-context** — SafeArea 처리
- **react-native-calendars** — 일정 캘린더 뷰

### Frontend (Web)

- **Vite + React + TypeScript** — 웹 프론트엔드
- **React Router v6** — 클라이언트 라우팅
- **Zustand** — 전역 상태 관리 (authStore, 모바일과 동일 구조)
- **Axios** — API 통신
- **Tailwind CSS** — 스타일링 (primary 색상 = #4F46E5)
- **Lucide React** — 아이콘
- **localStorage** — Refresh Token 저장 (모바일은 SecureStore)

### AI

- **Anthropic Claude** (`claude-sonnet-4-5`) — LLM (Agent 추론, 답변 생성, 일일 요약)
- **OpenAI** (`text-embedding-3-small`, 1536차원) — 임베딩 (벡터 검색 전용)
- **LangChain** (`langchain-anthropic`) — Agent + Tool Calling + RAG
- **pgvector** — 벡터 검색 (PostgreSQL 내장)

### 인프라

- **Render** — 백엔드 배포 (FastAPI)
- **Supabase** — PostgreSQL 호스팅 (pgvector 활성화 완료)
- **Upstash** — Redis 호스팅
- **Resend** — 이메일 발송 (이메일 인증, `@hs.ac.kr` 전용)
- **Expo Go** — 앱 개발/테스트

---

## 프로젝트 구조

```
unimate/
├── .claude/
│   └── rules/
│       ├── project.md       ← 지금 이 파일
│       ├── frontend.md      # 모바일 + 웹 프론트엔드 규칙
│       ├── backend.md
│       ├── frontend.md
│       ├── database.md
│       ├── ai.md
│       ├── auth.md
│       └── api.md
│
├── backend/
│   ├── main.py              # FastAPI 앱, 라우터 등록, CORS, 전역 예외 핸들러
│   ├── requirements.txt
│   ├── core/
│   │   ├── config.py         # pydantic-settings
│   │   ├── database.py       # SQLAlchemy async 엔진 + 세션
│   │   ├── redis.py          # Redis 연결
│   │   ├── security.py       # JWT 발급/검증, bcrypt
│   │   ├── dependencies.py   # HTTPBearer + get_current_user
│   │   ├── logging_config.py # 로깅 설정
│   │   └── response.py       # success(), error() 헬퍼
│   ├── models/               # SQLAlchemy ORM 모델 (12개 테이블)
│   ├── schemas/              # Pydantic 요청/응답 스키마
│   ├── routers/
│   │   ├── auth.py           # /register /login /refresh /change-password /withdraw
│   │   ├── users.py          # /me, /me/notification-settings, /me/interest-tags
│   │   ├── notices.py        # / /{id} /{id}/summary /bookmarks /{id}/bookmark
│   │   ├── assignments.py    # / /count /{id}
│   │   ├── schedules.py      # / /count /upcoming /next-exam /{id}
│   │   ├── chat.py           # POST /message (SSE), GET /daily-summary
│   │   └── admin.py          # POST /upload-pdf (admin 전용)
│   ├── services/
│   │   ├── auth_service.py
│   │   ├── user_service.py
│   │   ├── notice_service.py
│   │   ├── assignment_service.py
│   │   ├── schedule_service.py
│   │   ├── chat_service.py   # run_agent, get_daily_summary
│   │   └── email_service.py  # Resend 이메일 발송
│   ├── ai/
│   │   ├── agent.py          # ScholarshipAgent (Claude claude-sonnet-4-5, Redis 캐시 TTL 1h)
│   │   ├── embeddings.py     # embed_notice, embed_pdf_chunk (text-embedding-3-small)
│   │   └── tools/
│   │       ├── fetch_notices.py       # ILIKE 키워드 검색
│   │       ├── search_by_deadline.py  # 마감 임박 검색
│   │       └── answer_faq.py          # pgvector 코사인 유사도 검색 (≥0.75)
│   ├── crawler/
│   │   ├── spiders/
│   │   │   ├── notice_crawler.py  # 한신대 6개 카테고리 크롤링 → UPSERT + 임베딩
│   │   │   └── schedule_crawler.py
│   │   ├── worker.py              # Celery 앱 + crawl_notices_task
│   │   └── scheduler.py          # Celery Beat 진입점
│   ├── migrations/               # Alembic
│   ├── reset_admin.py            # 관리자 계정 초기화 스크립트
│   ├── run_crawler.py            # 크롤러 직접 실행 (Celery 없이)
│   └── tests/
│
├── web/                          # 웹 프론트엔드
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── .env                      # VITE_API_URL
│   └── src/
│       ├── App.tsx               # BrowserRouter + 인증 복원 (localStorage 기반)
│       ├── api/client.ts
│       ├── store/authStore.ts
│       ├── components/Layout.tsx # 사이드바 네비게이션
│       └── pages/
│           ├── auth/Login.tsx
│           ├── auth/Signup.tsx   # 3단계 회원가입
│           ├── Home.tsx          # 대시보드 (AI브리핑 + 추천공지)
│           ├── Notices.tsx
│           ├── NoticeDetail.tsx
│           ├── Chat.tsx          # AI 채팅 (SSE)
│           ├── Schedule.tsx      # 캘린더
│           └── Profile.tsx
│
└── mobile/
    ├── app.json
    ├── package.json
    ├── .env                  # EXPO_PUBLIC_API_URL
    ├── app/
    │   ├── _layout.tsx       # SafeAreaProvider + Stack
    │   ├── index.tsx         # 스플래시 → SecureStore 체크 → 리다이렉트
    │   ├── (auth)/
    │   │   ├── login.tsx
    │   │   └── signup/
    │   │       ├── index.tsx    # Step1: 기본정보
    │   │       ├── verify.tsx   # Step2: 이메일 인증
    │   │       └── complete.tsx # Step3: 관심사 선택
    │   └── (main)/
    │       ├── _layout.tsx      # 탭 네비게이터
    │       ├── home.tsx         # 대시보드 (추천공지 + AI브리핑 + 최신공지)
    │       ├── chat.tsx         # AI 채팅 (SSE fetch)
    │       ├── notices.tsx      # 공지 목록 (무한스크롤 + 필터)
    │       ├── notices/
    │       │   ├── [id].tsx     # 공지 상세 (AI 요약 + 북마크)
    │       │   └── bookmarks.tsx
    │       ├── schedule.tsx     # 캘린더 뷰
    │       ├── schedule/add.tsx
    │       ├── assignments.tsx
    │       ├── profile.tsx
    │       └── profile/
    │           ├── notification.tsx
    │           └── password.tsx
    ├── components/
    │   └── RecommendedNoticesDashboard.tsx  # 추천 공지 위젯 (일간/주간 TOP 3)
    ├── api/
    │   └── client.ts         # axios 인스턴스 + 인터셉터
    ├── hooks/
    │   └── useAuth.ts        # tokenStorage (SecureStore 래퍼)
    ├── store/
    │   └── authStore.ts      # Zustand (User.id: string = UUID)
    └── constants/
        ├── theme.ts          # colors, borderRadius, spacing, fontSize
        ├── api.ts            # API_BASE_URL
        └── departments.ts    # 학과 목록
```

---

## 환경변수

```bash
# Backend (backend/.env)
DATABASE_URL=postgresql+asyncpg://...@host:5432/postgres   # Supabase Session Pooler
REDIS_URL=rediss://...@host:6379                           # Upstash (TLS)
JWT_SECRET_KEY=your-secret-key-here
JWT_ACCESS_EXPIRE_MINUTES=30
JWT_REFRESH_EXPIRE_DAYS=14
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM_EMAIL=no-reply@yourdomain.com
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxx
ANTHROPIC_MODEL=claude-sonnet-4-5
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxx
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
APP_ENV=development   # 개발 환경: 이메일 인증번호 우회 활성화

# Mobile (mobile/.env)
EXPO_PUBLIC_API_URL=http://192.168.x.x:8000

# Web (web/.env)
VITE_API_URL=http://192.168.x.x:8000
```

> **LLM은 Claude, 임베딩만 OpenAI**. `OPENAI_LLM_MODEL`은 사용하지 않음.

---

## API 공통 응답 포맷

```json
{ "success": true,  "data": { ... }, "error": null }
{ "success": false, "data": null,    "error": { "code": "...", "message": "..." } }
```

Base URL: `/api/v1` | 클라이언트 데이터 접근: `res.data.data`

---

## 데이터 흐름

```
[크롤러]
  Celery Beat (07:00~18:00, 6회/일)
    → notice_crawler.py: 한신대 6개 카테고리 크롤링
    → notices 테이블 UPSERT (source_url 기준)
    → embed_notice(): notices.embedding 업데이트

[관리자 PDF 업로드]
  POST /api/v1/admin/upload-pdf
    → PyPDFLoader → RecursiveCharacterTextSplitter
    → embed_pdf_chunk(): qa_documents 테이블 INSERT

[AI Agent]
  사용자 질문
    → ScholarshipAgent.ask_stream()
    → Tool 선택: fetch_notices / search_by_deadline / answer_faq
    → answer_faq: notices.embedding + qa_documents.embedding 동시 벡터 검색
    → claude-sonnet-4-5 최종 답변 생성 (SSE 스트리밍)
    → Redis 캐시 TTL 1시간 (캐시 실패 시 in-memory fallback)

[홈 화면 추천 공지]
  GET /api/v1/notices/daily-top3
  GET /api/v1/notices/weekly-top3
    → 오늘/이번주 published_at 기준 최신 3건
    → 공지 없으면 전체 최신 3건 폴백
    → API 실패 시 클라이언트에서 목업 데이터 폴백
```
