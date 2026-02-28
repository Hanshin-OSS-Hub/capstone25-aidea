# 프론트엔드 설정 가이드

## 1. 의존성 설치

프론트엔드 폴더로 이동한 후 npm 패키지를 설치합니다:

```bash
cd frontend
npm install
```

## 2. 환경 변수 확인

`.env` 파일이 생성되어 있는지 확인하세요:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

## 3. 백엔드 서버 실행 확인

프론트엔드를 실행하기 전에 백엔드 서버가 실행 중인지 확인하세요:

```bash
# 다른 터미널에서 (프로젝트 루트에서)
cd backend
python main.py
```

백엔드가 `http://localhost:8000`에서 실행 중이어야 합니다.

## 4. 프론트엔드 개발 서버 실행

```bash
npm run dev
```

브라우저에서 http://localhost:5173 (또는 Vite가 알려주는 주소)로 접속하세요.

## 5. 주요 기능

### ✅ 구현 완료된 기능
- **AI 채팅**: 실제 백엔드 AI API 연결 (`/api/v1/ai/chat`)
- **공지사항**: 실제 DB 데이터 조회 (`/api/v1/notices`)
- **관심 등록**: 공지사항 북마크 기능 (`/api/v1/favorites`)
- **캘린더**: 일정 CRUD 기능 (`/api/v1/calendar`)
- **대시보드**: 관심 공지 & 다가오는 일정 조회

### 📌 테스트 방법
1. **AI 채팅 페이지**: "최근 공지사항 알려줘", "마감 임박한 공지 보여줘" 등 질문
2. **공지사항 페이지**: 전체 공지 목록 확인, 북마크 추가/제거
3. **캘린더 페이지**: 일정 추가/수정/삭제, 공지에서 일정 생성
4. **대시보드**: 관심 공지 & 다가오는 일정 확인

## 문제 해결

### CORS 오류 발생 시
백엔드 `main.py`에서 CORS 설정이 되어 있는지 확인:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### API 연결 실패 시
1. 백엔드 서버가 실행 중인지 확인
2. `.env` 파일의 API URL 확인
3. 브라우저 개발자 도구(F12) Console에서 에러 확인
