# UniMate — Database 규칙

> PostgreSQL 15+ | pgvector | SQLAlchemy (async) | Alembic

---

## 테이블 목록 (12개)

| # | 테이블 | 설명 |
| --- | --- | --- |
| 1 | `users` | 서비스 사용자 (학생) |
| 2 | `email_verifications` | 이메일 인증번호 관리 |
| 3 | `refresh_tokens` | Refresh Token 저장 |
| 4 | `notices` | 학교 포털 크롤링 공지 (**embedding 컬럼 포함**) |
| 5 | `user_notice_bookmarks` | 공지 북마크 |
| 6 | `assignments` | 사용자 과제 |
| 7 | `user_interest_tags` | 사용자 관심 태그 |
| 8 | `user_schedules` | 개인/학사 일정 |
| 9 | `chat_sessions` | AI 채팅 세션 |
| 10 | `chat_messages` | AI 채팅 메시지 |
| 11 | `notifications` | FCM 알림 내역 |
| 12 | `qa_documents` | PDF 청크 + embedding (RAG용, **구현 완료**) |

---

## 핵심 테이블 스키마

### notices (embedding 컬럼 추가됨)

```sql
CREATE TABLE notices (
    id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    title            VARCHAR(500)  NOT NULL,
    content          TEXT,
    summary          TEXT,
    category         VARCHAR(50),
    importance_score FLOAT         NOT NULL DEFAULT 0.0,
    source_url       VARCHAR(1000) UNIQUE,
    source_type      VARCHAR(50),
    published_at     TIMESTAMPTZ,
    crawled_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    embedding        vector(1536)  -- text-embedding-3-small, 크롤링 후 자동 생성
);
CREATE INDEX ix_notices_category ON notices(category);
CREATE INDEX ix_notices_published_at ON notices(published_at);
CREATE INDEX idx_notices_embedding ON notices
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### qa_documents (구현 완료)

```sql
CREATE TABLE qa_documents (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    title      VARCHAR(500) NOT NULL,
    content    TEXT         NOT NULL,
    category   VARCHAR(50),
    source_url VARCHAR(1000),
    embedding  vector(1536),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_qa_embedding ON qa_documents
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### user_schedules

```sql
CREATE TABLE user_schedules (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    description TEXT,
    category    VARCHAR(50),
    source      VARCHAR(20) NOT NULL DEFAULT 'user',
    start_at    TIMESTAMPTZ NOT NULL,  -- ISO 8601 형식 필수
    end_at      TIMESTAMPTZ,
    is_allday   BOOLEAN     NOT NULL DEFAULT FALSE,
    alert_days  JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## ORM 모델 작성 규칙

SQLAlchemy 2.x `Mapped[]` 스타일 사용. 모든 모델은 `core.database.Base` 상속.

```python
# models/notice.py
from pgvector.sqlalchemy import Vector
from sqlalchemy import Column

class Notice(Base):
    __tablename__ = "notices"
    # ... Mapped[] 컬럼들
    embedding = Column(Vector(1536), nullable=True)  # pgvector는 Column() 사용
```

```python
# models/qa_document.py
class QaDocument(Base):
    __tablename__ = "qa_documents"
    # ... Mapped[] 컬럼들
    embedding = Column(Vector(1536), nullable=True)
```

> pgvector의 `Vector` 컬럼은 `Mapped[]` 대신 `Column()` 사용.

---

## DB 접근 패턴

### 소프트 딜리트 (deleted_at IS NULL 필수)

```python
result = await db.execute(
    select(User).where(User.id == user_id, User.deleted_at == None)
)
```

### pgvector 유사도 검색

```python
from pgvector.sqlalchemy import Vector

async def search_similar(query_embedding: list, top_k: int = 5, db=None):
    result = await db.execute(
        select(QaDocument)
        .where(1 - QaDocument.embedding.cosine_distance(query_embedding) >= 0.75)
        .order_by(QaDocument.embedding.cosine_distance(query_embedding))
        .limit(top_k)
    )
    return result.scalars().all()
```

### UPSERT (크롤러용)

```python
from sqlalchemy.dialects.postgresql import insert as pg_insert

stmt = pg_insert(Notice).values(data)
stmt = stmt.on_conflict_do_update(
    index_elements=['source_url'],
    set_={'title': stmt.excluded.title, 'content': stmt.excluded.content, 'crawled_at': stmt.excluded.crawled_at}
)
await db.execute(stmt)
await db.commit()
```

---

## 마이그레이션 규칙 (Alembic)

```bash
alembic revision --autogenerate -m "description"
alembic upgrade head
alembic downgrade -1
```

- pgvector 관련 마이그레이션은 raw SQL 사용 (`op.execute()`)
- `notices.embedding` 컬럼과 `qa_documents` 테이블은 수동 마이그레이션으로 생성 완료
- Supabase에서 `pgvector` 확장은 이미 활성화됨 (`CREATE EXTENSION` 불필요)

---

## Redis 캐시 정책

| 키 패턴 | TTL | 용도 |
| --- | --- | --- |
| `chat:cache:{md5(query)}` | 1시간 | AI 응답 캐시 |
| `summary:{user_id}` | 1시간 | 일일 요약 캐시 |
| `email:cooldown:{email}` | 60초 | 인증번호 재전송 방지 |

---

## 보안 규칙

- 비밀번호: `bcrypt` 해시. 평문 저장 절대 금지
- Refresh Token: SHA-256 해시 저장 (`token_hash`)
- 소프트 딜리트: `deleted_at IS NULL` 조건을 모든 users 쿼리에 반드시 포함
- `student_number`, `phone_enc`: pgcrypto로 암호화 저장
