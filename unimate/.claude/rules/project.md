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
- **Celery + Beat** — 크롤링 스케줄러 + 비동기 작업
- **SQLAlchemy** (async, asyncpg) — ORM
- **Alembic** — DB 마이그레이션

### Frontend (Mobile)

- **React Native + Expo** (SDK 54+)
- **Expo Router** — 파일 기반 라우팅
- **Zustand** — 전역 상태 관리
- **Axios** — API 통신
- **expo-secure-store** — Refresh Token 저장
- **react-native-safe-area-context** — SafeArea 처리

### AI

- **OpenAI** (`gpt-4o`) — LLM (Agent 추론, 답변 생성, 일일 요약)
- **OpenAI** (`text-embedding-3-small`, 1536차원) — 임베딩
- **LangChain** — Agent + Tool Calling + RAG
- **pgvector** — 벡터 검색 (PostgreSQL 내장)

### 인프라

- **Render** — 백엔드 배포 (FastAPI)
- **Supabase** — PostgreSQL 호스팅 (pgvector 활성화 완료)
- **Upstash** — Redis 호스팅
- **Resend** — 이메일 발송 (이메일 인증)
- **Expo Go** — 앱 개발/테스트

---

## 프로젝트 구조

```
unimate/
├── .cursor/
│   └── rules/
│       ├── project.md       ← 지금 이 파일
│       ├── backend.md
│       ├── frontend.md
│       ├── database.md
│       ├── ai.md
│       ├── auth.md
│       └── api.md
│
├── backend/
│   ├── main.py              # FastAPI 앱 생성, 라우터 등록, CORS, 전역 예외 핸들러
│   ├── requirements.txt
│   ├── core/
│   │   ├── config.py         # pydantic-settings (OPENAI_LLM_MODEL 포함)
│   │   ├── database.py       # SQLAlchemy async 엔진 + 세션
│   │   ├── redis.py          # Redis 연결
│   │   ├── security.py       # JWT 발급/검증, bcrypt
│   │   ├── dependencies.py   # HTTPBearer + get_current_user
│   │   └── response.py       # success(), error() 헬퍼
│   ├── models/               # ORM 모델 (Notice, QaDocument 등)
│   ├── schemas/
│   ├── routers/
│   │   ├── auth.py
│   │   ├── users.py
│   │   ├── notices.py
│   │   ├── assignments.py
│   │   ├── schedules.py
│   │   ├── chat.py           # POST /message (SSE), GET /daily-summary
│   │   └── admin.py          # POST /upload-pdf (관리자 전용)
│   ├── services/
│   │   ├── chat_service.py   # run_agent, get_daily_summary
│   │   └── ...
│   ├── ai/
│   │   ├── agent.py          # ScholarshipAgent (OpenAI Tool Calling)
│   │   ├── embeddings.py     # embed_notice, embed_pdf_chunk
│   │   └── tools/
│   │       ├── fetch_notices.py
│   │       ├── search_by_deadline.py
│   │       └── answer_faq.py
│   ├── crawler/
│   │   ├── spiders/
│   │   │   └── notice_crawler.py  # 한신대 6개 카테고리 크롤링
│   │   ├── worker.py              # Celery 앱 + crawl_notices_task
│   │   └── scheduler.py          # Celery Beat 진입점
│   ├── migrations/
│   └── tests/
│
└── mobile/
    ├── app.json
    ├── package.json
    ├── .env                  # EXPO_PUBLIC_API_URL
    ├── app/
    │   ├── _layout.tsx       # SafeAreaProvider + Stack
    │   ├── index.tsx
    │   ├── (auth)/
    │   │   └── login.tsx
    │   └── (main)/
    │       ├── _layout.tsx   # 탭 네비게이터
    │       ├── home.tsx
    │       ├── chat.tsx      # AI 채팅 (SSE fetch)
    │       ├── notices.tsx
    │       ├── notices/[id].tsx
    │       ├── schedule.tsx
    │       ├── schedule/add.tsx
    │       ├── assignments.tsx
    │       ├── profile.tsx
    │       └── profile/notification.tsx
    ├── api/
    │   └── client.ts         # axios 인스턴스 + 인터셉터
    ├── hooks/
    │   └── useAuth.ts        # tokenStorage (SecureStore 래퍼)
    ├── store/
    │   └── authStore.ts      # Zustand (User.id: string = UUID)
    └── constants/
        ├── theme.ts
        └── api.ts            # API_BASE_URL
```

---

## 환경변수 (.env)

```bash
# Database
DATABASE_URL=postgresql+asyncpg://postgres:password@host:5432/postgres

# Redis
REDIS_URL=redis://localhost:6379
CELERY_BROKER_URL=redis://localhost:6379/0

# JWT
JWT_SECRET_KEY=your-secret-key-here
JWT_ACCESS_EXPIRE_MINUTES=30
JWT_REFRESH_EXPIRE_DAYS=14

# Resend (이메일 인증)
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM_EMAIL=no-reply@yourdomain.com

# OpenAI (LLM + Embedding)
OPENAI_API_KEY=sk-xxxxxxxxxxxx
OPENAI_LLM_MODEL=gpt-4o
```

> `ANTHROPIC_API_KEY`는 사용하지 않음. LLM과 Embedding 모두 OpenAI 사용.

---

## API 공통 응답 포맷

모든 API는 아래 포맷을 반드시 따른다.

```json
// 성공
{ "success": true, "data": { ... }, "error": null }

// 실패
{ "success": false, "data": null, "error": { "code": "ERROR_CODE", "message": "설명" } }
```

Base URL: `/api/v1`

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
    → gpt-4o 최종 답변 생성 (SSE 스트리밍)
```
