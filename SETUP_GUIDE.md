# AIdea 프로그램 실행 가이드

## 📋 사전 준비 사항

### 1. Node.js 설치 (프론트엔드용)

프론트엔드를 실행하려면 Node.js가 필요합니다.

**설치 방법:**
1. [Node.js 공식 웹사이트](https://nodejs.org/) 접속
2. **LTS 버전** 다운로드 (권장: v20.x.x)
3. 다운로드한 설치 파일 실행
4. 설치 완료 후 PowerShell 또는 명령 프롬프트 재시작
5. 설치 확인:
   ```bash
   node --version
   npm --version
   ```

### 2. Python 가상환경 (이미 설정됨)

백엔드는 Python venv를 사용합니다 (이미 설정 완료).

---

## 🚀 프로그램 실행 방법

### **1단계: 백엔드 서버 실행**

PowerShell 또는 명령 프롬프트를 열고:

```bash
# 프로젝트 루트 폴더로 이동
cd C:\Users\rache\Desktop\AIdea

# 가상환경 활성화 (Windows)
venv\Scripts\activate

# 백엔드 서버 실행
cd backend
python main.py
```

**실행 확인:**
- 터미널에 "Uvicorn running on http://0.0.0.0:8000" 메시지가 표시되면 성공
- 브라우저에서 http://localhost:8000/docs 접속하여 API 문서 확인 가능

### **2단계: 프론트엔드 서버 실행** (Node.js 설치 후)

**새로운 PowerShell 창**을 열고:

```bash
# 프론트엔드 폴더로 이동
cd C:\Users\rache\Desktop\AIdea\frontend

# 의존성 설치 (최초 1회만)
npm install

# 개발 서버 실행
npm run dev
```

**실행 확인:**
- 터미널에 "Local: http://localhost:5173/" 메시지가 표시되면 성공
- 자동으로 브라우저가 열리거나, 직접 http://localhost:5173 접속

---

## 🎯 프로그램 사용하기

### 접속 주소
- **프론트엔드**: http://localhost:5173
- **백엔드 API**: http://localhost:8000
- **API 문서**: http://localhost:8000/docs

### 주요 기능

#### 1. 대시보드 (홈)
- 오늘의 일정 & 다가오는 일정 확인
- 관심 등록한 공지사항 한눈에 보기
- 캘린더 미리보기

#### 2. 전체 공지
- 92개의 실제 한신대학교 공지사항
- 카테고리별 필터 (장학, 학사, 행사, 공모전 등)
- 마감 임박 / 마감 상태별 필터
- 공지사항 북마크 (관심 등록)

#### 3. 캘린더
- 개인 일정 추가/수정/삭제
- 공지사항에서 일정 자동 생성
- 월별/날짜별 일정 조회
- D-day 표시

#### 4. AI 도우미
- **"최근 공지사항 알려줘"** → 최신 공지 5개 조회
- **"마감 임박한 공지 보여줘"** → 7일 이내 마감 공지 조회
- **"장학금 관련 공지 찾아줘"** → 키워드 검색
- 실제 AI가 DB에서 검색하여 답변

#### 5. 마이페이지
- 활동 내역 관리
- 참여한 공지사항 확인
- 프로필 정보

---

## 🔧 문제 해결

### Node.js 설치 후에도 명령어를 찾을 수 없다면?
1. PowerShell 또는 명령 프롬프트를 **완전히 종료** 후 재시작
2. 시스템 환경 변수에 Node.js 경로가 추가되었는지 확인
   - 시스템 속성 → 환경 변수 → Path에 `C:\Program Files\nodejs\` 포함 여부 확인

### 백엔드 서버가 실행되지 않는다면?
```bash
# 가상환경 활성화 확인
venv\Scripts\activate

# 필요한 패키지 재설치
pip install -r requirements.txt

# PostgreSQL 연결 확인
# .env 파일에서 DB 정보 확인
```

### 프론트엔드에서 데이터가 안 보인다면?
1. 백엔드 서버가 실행 중인지 확인 (http://localhost:8000/docs)
2. 브라우저 개발자 도구(F12) → Console 탭에서 에러 확인
3. CORS 에러가 있다면 백엔드 `main.py`의 CORS 설정 확인

### 포트가 이미 사용 중이라면?
```bash
# 백엔드 포트 확인 (8000)
netstat -ano | findstr :8000

# 프론트엔드 포트 확인 (5173)
netstat -ano | findstr :5173

# 프로세스 종료 (PID 확인 후)
taskkill /PID <프로세스ID> /F
```

---

## 📊 데이터 현황

### 데이터베이스 (PostgreSQL)
- **공지사항**: 92개 (한신대학교 실제 공지)
- **AI 분석 데이터**: 92개 (요약, 카테고리, 날짜 추출 완료)
- **사용자**: 1명 (테스트 계정)

### API 엔드포인트
- 공지사항: `/api/v1/notices`
- 관심 등록: `/api/v1/favorites`
- 캘린더: `/api/v1/calendar`
- 대시보드: `/api/v1/dashboard`
- AI 채팅: `/api/v1/ai/chat`

---

## 🎓 개발 정보

- **백엔드**: Python (FastAPI) + PostgreSQL + LangChain + OpenAI GPT-4
- **프론트엔드**: React + TypeScript + Vite + TailwindCSS
- **AI 기능**: ReAct Agent (LangGraph), FAISS Vector DB, GPT-4o

---

## 📞 추가 도움말

더 자세한 내용은:
- **백엔드 README**: `backend/` 폴더
- **프론트엔드 설정**: `frontend/FRONTEND_SETUP.md`
- **API 문서**: http://localhost:8000/docs (서버 실행 후)
