# UniMate — API 컨벤션

> Base URL: `/api/v1` | 모든 응답은 JSON

---

## 공통 응답 포맷

**절대 변경 금지. 모든 엔드포인트가 이 포맷을 따른다.**

```json
// 성공
{
  "success": true,
  "data": { ... },
  "error": null
}

// 실패
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "사람이 읽을 수 있는 설명"
  }
}
```

---

## HTTP 상태 코드

| 상황 | 코드 |
|------|------|
| 성공 (조회) | 200 |
| 성공 (생성) | 201 |
| 인증 실패 | 401 |
| 권한 없음 | 403 |
| 리소스 없음 | 404 |
| 입력값 오류 | 422 |
| 서버 오류 | 500 |

---

## 페이지네이션

목록 조회 API는 아래 형식을 따른다.

```
GET /api/v1/notices?page=1&limit=20
```

```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "total": 128,
    "page": 1,
    "limit": 20,
    "has_next": true
  },
  "error": null
}
```

---

## 전체 엔드포인트 목록

### Auth (`/api/v1/auth`)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/check-username?username=` | 아이디 중복 확인 |
| POST | `/email/send-code` | 인증번호 발송 |
| POST | `/email/verify-code` | 인증번호 검증 |
| POST | `/signup` | 회원가입 |
| POST | `/login` | 로그인 |
| POST | `/refresh` | 토큰 갱신 |
| POST | `/logout` | 로그아웃 🔒 |
| DELETE | `/me` | 회원탈퇴 🔒 |

### Users (`/api/v1/users`)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/me` | 내 정보 조회 🔒 |
| PATCH | `/me` | 프로필 수정 🔒 |
| PUT | `/me/fcm-token` | FCM 토큰 등록 🔒 |
| PUT | `/me/notification-settings` | 알림 설정 변경 🔒 |

### Notices (`/api/v1/notices`)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/` | 공지 목록 🔒 |
| GET | `/{id}` | 공지 상세 🔒 |
| GET | `/{id}/summary` | 공지 AI 요약 🔒 |
| GET | `/unread-count` | 미확인 공지 수 🔒 |
| POST | `/{id}/bookmark` | 북마크 토글 🔒 |
| GET | `/bookmarks` | 내 북마크 목록 🔒 |

### Assignments (`/api/v1/assignments`)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/` | 과제 목록 🔒 |
| GET | `/count` | 미완료 과제 수 🔒 |
| POST | `/` | 과제 생성 🔒 |
| PUT | `/{id}` | 과제 수정 🔒 |
| DELETE | `/{id}` | 과제 삭제 🔒 |

### Schedules (`/api/v1/schedules`)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/` | 일정 목록 🔒 |
| POST | `/` | 일정 생성 🔒 |
| PUT | `/{id}` | 일정 수정 🔒 |
| DELETE | `/{id}` | 일정 삭제 🔒 |
| GET | `/next-exam` | 다음 시험 D-Day 🔒 |

### Chat (`/api/v1/chat`)

| Method | Path | 설명 |
|--------|------|------|
| POST | `/message` | AI 채팅 (SSE 스트리밍) 🔒 |
| GET | `/daily-summary` | 오늘의 AI 브리핑 🔒 |

### Admin (`/api/v1/admin`)

| Method | Path | 설명 |
|--------|------|------|
| POST | `/upload-pdf` | PDF 업로드 → RAG 임베딩 🔒 (admin) |

> 🔒 = Bearer Token 필요 (HTTPBearer)

---

## SSE 스트리밍 프로토콜

`POST /api/v1/chat/message` 응답은 `text/event-stream` 형식.

```
data: {"type": "session_id", "content": "uuid-here"}

data: {"type": "token", "content": "답변"}
data: {"type": "token", "content": " 텍스트"}

data: {"type": "done"}
```

| type | 의미 |
|------|------|
| `session_id` | 세션 ID 전달 |
| `token` | 텍스트 청크 (content에 누적) |
| `done` | 스트리밍 완료 |

---

## 일정 생성 요청 형식

```json
POST /api/v1/schedules
{
  "title": "일정 제목",
  "start_at": "2026-04-10T09:00:00.000Z",
  "end_at": null,
  "category": "개인",
  "description": "메모 내용",
  "is_allday": false,
  "source": "user"
}
```

> `start_at`은 반드시 ISO 8601 형식.

---

## 에러 코드 목록

| code | 상황 |
|------|------|
| `UNAUTHORIZED` | 토큰 없음 또는 만료 |
| `INVALID_TOKEN` | 토큰 형식 오류 |
| `USER_NOT_FOUND` | 사용자 없음 또는 탈퇴 |
| `WRONG_PASSWORD` | 비밀번호 불일치 |
| `USERNAME_TAKEN` | 아이디 중복 |
| `EMAIL_ALREADY_USED` | 이메일 중복 |
| `CODE_EXPIRED` | 인증번호 만료 |
| `CODE_INVALID` | 인증번호 불일치 |
| `NOT_FOUND` | 리소스 없음 |
| `VALIDATION_ERROR` | 입력값 오류 |
| `INTERNAL_ERROR` | 서버 오류 |

---

## 네이밍 규칙

- URL: `kebab-case` (`/send-code`, `/read-all`)
- JSON 키: `snake_case` (`access_token`, `published_at`)
- 날짜/시간: ISO 8601 (`2026-04-05T09:00:00Z`)
- Boolean 필드: `is_` 또는 `has_` prefix (`is_read`, `has_next`)
