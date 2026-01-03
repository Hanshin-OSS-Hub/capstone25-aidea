# frontend/ui.py

import streamlit as st
import requests
import time

# --- 1. 페이지 설정 (가장 먼저 실행) ---
st.set_page_config(
    page_title="한신대 AI 비서",
    page_icon="🎓",
    layout="centered", # 'wide' 대신 'centered'로 집중도 높임
    initial_sidebar_state="collapsed", # 사이드바 기본 숨김 (더 깔끔하게)
)

# --- 2. 🎨 CSS 매직 (여기가 핵심!) ---
# Streamlit의 기본 스타일을 뜯어고치는 고급 CSS입니다.
st.markdown("""
<style>
    /* 1. 웹폰트 적용 (Inter: 요즘 가장 인기 있는 깔끔한 폰트) */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');
    
    html, body, [class*="css"] {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        background-color: #f5f7fb; /* 배경색을 아주 연한 회색으로 */
    }

    /* 2. 불필요한 요소 숨기기 */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    header {visibility: hidden;}
    .stDeployButton {display:none;}

    /* 3. 메인 채팅 영역 스타일링 */
    .main .block-container {
        padding-top: 2rem;
        padding-bottom: 6rem; /* 입력창 공간 확보 */
        max-width: 800px; /* 너무 넓지 않게 중앙 집중 */
    }

    /* 4. 채팅 메시지 컨테이너 공통 스타일 */
    .stChatMessage {
        padding: 1rem;
        border-radius: 1.2rem;
        margin-bottom: 1rem;
        box-shadow: 0 2px 5px rgba(0,0,0,0.05); /* 부드러운 그림자 */
        border: none; /* 기본 테두리 제거 */
    }

    /* 🎯 고급 해킹: 아바타를 기준으로 사용자/AI 말풍선 색상 다르게 주기 
       (Streamlit 구조상 이 방법이 최선입니다) */
    
    /* AI (🤖) 메시지 스타일 */
    div[data-testid="stChatMessage"]:has(div[data-testid="stImage"][alt="🤖"]) {
        background-color: #ffffff; /* 흰색 배경 */
        border-top-left-radius: 0; /* 말풍선 꼬리 느낌 */
    }

    /* 사용자 (🧑‍💻) 메시지 스타일 */
    div[data-testid="stChatMessage"]:has(div[data-testid="stImage"][alt="🧑‍💻"]) {
        background-color: #e3effd; /* 아주 연한 파란색 배경 */
        border-top-right-radius: 0; /* 말풍선 꼬리 느낌 */
        flex-direction: row-reverse; /* (선택사항) 아이콘을 오른쪽으로 보내고 싶을 때 */
        /* text-align: right; 텍스트 우측 정렬은 가독성을 위해 뺍니다 */
    }

    /* 5. 아바타 아이콘 스타일 */
    .stChatMessage .stImage {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    /* 6. 하단 입력창 스타일링 (떠있는 느낌) */
    .stChatInput {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        width: 100%;
        max-width: 800px; /* 메인 컨테이너 너비와 맞춤 */
        z-index: 999;
        padding: 0 1rem;
    }

    .stChatInputContainer > div {
        background-color: #ffffff;
        border-radius: 25px !important;
        padding: 5px 10px;
        border: 1px solid #e0e0e0 !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1); /* 입력창 강조 그림자 */
    }
    
    /* 입력창 포커스 시 효과 */
    .stChatInputContainer > div:focus-within {
        border-color: #4a90e2 !important;
        box-shadow: 0 4px 12px rgba(74, 144, 226, 0.2);
    }

    /* 7. 헤더 스타일 */
    .header-container {
        text-align: center;
        margin-bottom: 3rem;
        padding: 2rem;
        background: white;
        border-radius: 1.5rem;
        box-shadow: 0 4px 15px rgba(0,0,0,0.05);
    }
    .header-title {
        font-size: 2.2rem;
        font-weight: 700;
        color: #1a1a1a;
        margin-bottom: 0.5rem;
    }
    .header-subtitle {
        font-size: 1.1rem;
        color: #666;
    }
</style>
""", unsafe_allow_html=True)


# --- 3. 메인 헤더 영역 ---
st.markdown("""
<div class="header-container">
    <div style="font-size: 3rem; margin-bottom: 1rem;">🎓</div>
    <div class="header-title">한신대 스마트 규정 비서</div>
    <div class="header-subtitle">복잡한 학사/장학 규정, AI에게 쉽고 빠르게 물어보세요.</div>
</div>
""", unsafe_allow_html=True)


# --- 4. 사이드바 (옵션) ---
with st.sidebar:
    st.title("ℹ️ 사용 가이드")
    st.info(
        """
        **💡 이렇게 물어보세요**
        
        * "이번 학기 성적 장학금 기준 알려줘"
        * "휴학 신청은 언제부터 언제까지야?"
        * "졸업 논문 대체 요건이 궁금해"
        
        ---
        *본 서비스는 학교 규정집 PDF를 기반으로 답변합니다.*
        """
    )
    if st.button("✨ 새 대화 시작하기", type="primary"):
        st.session_state.messages = []
        st.rerun()


# --- 5. 채팅 로직 ---

# 세션 초기화
if "messages" not in st.session_state:
    st.session_state.messages = []
    # 웰컴 메시지
    st.session_state.messages.append({
        "role": "assistant", 
        "content": "안녕하세요! 무엇을 도와드릴까요? 😊\n\n궁금한 규정 내용을 아래 입력창에 적어주세요."
    })

# 아바타 설정 (가장 깔끔한 이모지 사용)
USER_AVATAR = "🧑‍💻"
BOT_AVATAR = "🤖"

# 대화 기록 출력
for message in st.session_state.messages:
    avatar = USER_AVATAR if message["role"] == "user" else BOT_AVATAR
    with st.chat_message(message["role"], avatar=avatar):
        st.markdown(message["content"])

# 사용자 입력 처리
if prompt := st.chat_input("질문을 입력하세요..."):
    # 1) 사용자 메시지 표시
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user", avatar=USER_AVATAR):
        st.markdown(prompt)

    # 2) AI 답변 처리
    with st.chat_message("assistant", avatar=BOT_AVATAR):
        message_placeholder = st.empty()
        full_response = ""
        
        # 로딩 스피너를 좀 더 세련되게
        with st.spinner("🧠 규정 데이터를 분석 중입니다..."):
            try:
                # 백엔드 서버 주소 확인!
                BACKEND_URL = "http://localhost:8000/chat" 
                response = requests.post(BACKEND_URL, json={"query": prompt}, timeout=30)
                
                if response.status_code == 200:
                    full_response = response.json()["answer"]
                else:
                    full_response = f"⚠️ **서버 오류** (상태 코드: {response.status_code})\n\n잠시 후 다시 시도해주세요."
                    
            except requests.exceptions.ConnectionError:
                 full_response = "⚠️ **서버 연결 실패**\n\n백엔드 서버(`python -m backend.main`)가 켜져 있는지 확인해주세요."
            except Exception as e:
                full_response = f"⚠️ **알 수 없는 오류 발생**\n\n에러 내용: {e}"
        
        # 답변 타이핑 효과 구현
        displayed_response = ""
        for char in full_response:
            displayed_response += char
            # 커서 효과 (▌) 추가해서 더 리얼하게
            message_placeholder.markdown(displayed_response + "▌")
            time.sleep(0.01) # 속도 조절 (너무 느리면 답답함)
            
        # 최종 답변 표시 (커서 제거)
        message_placeholder.markdown(full_response)

    # 3) AI 답변 기록 저장
    st.session_state.messages.append({"role": "assistant", "content": full_response})