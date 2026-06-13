# UniMate — AI 개발 규칙

> Claude (Anthropic) + LangChain Tool Calling + pgvector RAG
> 임베딩 전용: OpenAI text-embedding-3-small

---

## AI 구조 개요

```
사용자 질문
    ↓
ScholarshipAgent (Claude claude-sonnet-4-5)
    ↓ Tool Calling
┌───────────────────────────────┐
│  fetch_notices                │ → ILIKE 키워드 검색 (notices 테이블)
│  search_by_deadline           │ → 마감 임박 공지 검색
│  answer_faq                   │ → pgvector 벡터 검색 (notices + qa_documents)
└───────────────────────────────┘
    ↓ 결과 수집
claude-sonnet-4-5 → 최종 답변 생성 (SSE 스트리밍)
```

---

## 디렉토리 구조

```
backend/ai/
├── agent.py          # ScholarshipAgent (Redis 캐시, ask_stream)
├── embeddings.py     # embed_notice, embed_pdf_chunk (OpenAI)
└── tools/
    ├── fetch_notices.py       # @tool: 키워드 + 카테고리 검색
    ├── search_by_deadline.py  # @tool: 최근 N일 내 공지
    └── answer_faq.py          # @tool: 벡터 유사도 검색
```

---

## Agent 구현 (ScholarshipAgent)

```python
# ai/agent.py
from langchain_anthropic import ChatAnthropic
from core.config import settings

class ScholarshipAgent:
    def __init__(self):
        self.llm = ChatAnthropic(
            model=settings.ANTHROPIC_MODEL,   # claude-sonnet-4-5
            temperature=0,
            max_tokens=3000,
            anthropic_api_key=settings.ANTHROPIC_API_KEY.strip(),
        )
        tools = [fetch_notices, search_by_deadline, answer_faq]
        self.llm_with_tools = self.llm.bind_tools(tools)

    async def ask(self, query: str) -> str:
        # Redis 캐시 확인 → Tool Calling → 답변 생성
        ...

    async def ask_stream(self, query: str) -> AsyncGenerator[str, None]:
        answer = await self.ask(query)
        yield json.dumps({"type": "token", "content": answer}, ensure_ascii=False)
        yield json.dumps({"type": "done"}, ensure_ascii=False)
```

### 캐싱 전략

- Redis 키: `chat:cache:{md5(query)}`, TTL: 3600초
- Redis 실패 시 in-memory dict fallback

---

## Tool 정의 (LangChain @tool)

```python
# ai/tools/fetch_notices.py
from langchain_core.tools import tool

@tool
async def fetch_notices(query: str, category: Optional[str] = None) -> str:
    """학교 공지사항을 키워드로 검색합니다."""
    # notices 테이블 ILIKE 검색
    ...
```

```python
# ai/tools/search_by_deadline.py
@tool
async def search_by_deadline(days_ahead: int = 7) -> str:
    """최근 N일 이내 게시된 공지를 조회합니다."""
    ...
```

```python
# ai/tools/answer_faq.py
@tool
async def answer_faq(query: str) -> str:
    """학칙, 규정, 공지에서 유사한 내용을 벡터 검색합니다."""
    # notices.embedding + qa_documents.embedding 동시 검색
    # cosine similarity >= 0.75
    ...
```

---

## Embedding 구현

```python
# ai/embeddings.py
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

async def _get_embedding(text: str) -> list[float]:
    response = await client.embeddings.create(
        model="text-embedding-3-small",
        input=text[:8000]
    )
    return response.data[0].embedding  # 1536차원

async def embed_notice(notice_id, text):
    """크롤링 후 notices.embedding 업데이트"""
    embedding = await _get_embedding(text)
    # UPDATE notices SET embedding = ... WHERE id = notice_id

async def embed_pdf_chunk(title, content, category, source_url):
    """PDF 청크를 qa_documents에 INSERT"""
    embedding = await _get_embedding(content)
    # INSERT INTO qa_documents (title, content, category, source_url, embedding)
```

---

## SSE 스트리밍 응답

```python
# routers/chat.py
from fastapi.responses import StreamingResponse

@router.post("/message")
async def chat_message(request: ChatRequest, current_user=Depends(get_current_user)):
    async def event_generator():
        agent = ScholarshipAgent()
        async for chunk in agent.ask_stream(request.message):
            yield f"data: {chunk}\n\n"
    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

---

## 크롤러 연동

크롤러가 공지를 UPSERT한 후 자동으로 임베딩 생성:

```python
# crawler/spiders/notice_crawler.py
async def _upsert_notice(self, data):
    # 1. notices 테이블 UPSERT (source_url 기준)
    # 2. embed_notice(notice_id, content) 호출
    # 3. 임베딩 실패 시 graceful 처리 (공지 저장은 유지)
```

---

## PDF 업로드 → RAG

```python
# routers/admin.py
@router.post("/upload-pdf")
async def upload_pdf(file: UploadFile, current_user=Depends(get_current_user)):
    # 1. role == 'admin' 확인
    # 2. PyPDFLoader → 텍스트 추출
    # 3. RecursiveCharacterTextSplitter (1000자, overlap 200)
    # 4. 각 청크마다 embed_pdf_chunk() 호출 → qa_documents INSERT
```

---

## 모델 사용 규칙

| 용도 | 모델 | API |
| --- | --- | --- |
| Agent / 채팅 / 일일 요약 | `claude-sonnet-4-5` | Anthropic (`ANTHROPIC_API_KEY`) |
| 임베딩 | `text-embedding-3-small` | OpenAI (`OPENAI_API_KEY`) |

> LLM은 Claude, 임베딩만 OpenAI. 두 API 키 모두 `.env`에 필요.
> `.env`에 `ANTHROPIC_MODEL=claude-sonnet-4-5` 설정 필수 — 모델명 오타 시 404 에러 발생.

---

## 금지 사항

- Tool 결과 없이 추측으로 답변 생성 금지
- 대화 히스토리 20턴 초과 전달 금지
- 사용자 개인정보를 LLM API에 원문 전달 금지
- 임베딩 모델 임의 변경 금지 (변경 시 전체 재임베딩 필요)
- LLM을 OpenAI로 되돌리지 말 것 → Claude 고정
