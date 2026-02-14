# backend/agent/tools/generator.py

"""
답변 생성 도구: 검색된 규정과 질문을 합쳐 자연스러운 답변 작성 (최적화 버전)
역할: 검색된 정보(Context)와 사용자의 질문(Query)을 받아서, 
       학생에게 말하듯 친절하게 답변을 작성합니다.
ReAct Agent가 호출할 수 있는 LangChain Tool로 구현됨.
"""

import os
import sys
from dotenv import load_dotenv

# 경로 설정
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

load_dotenv()

# LLM 인스턴스를 싱글톤으로 관리
_llm_instance = None

def get_llm_instance():
    """LLM 인스턴스를 싱글톤으로 관리"""
    global _llm_instance
    if _llm_instance is None:
        _llm_instance = ChatOpenAI(
            model="gpt-4o",
            temperature=0.1,  # 약간의 창의성 추가
            max_tokens=500,   # 답변 길이 제한
            top_p=0.9,
        )
    return _llm_instance

@tool
def generate_answer(context: str, question: str) -> str:
    """
    검색된 규정과 사용자 질문으로 최종 답변을 생성합니다.
    
    검색된 정보(context)와 사용자의 질문(question)을 받아서,
    자연스러운 한국어 답변을 생성합니다.
    
    Args:
        context (str): 벡터 DB에서 검색된 규정 내용 (정제됨)
        question (str): 사용자의 원본 질문
        
    Returns:
        str: 생성된 최종 답변
    """
    llm = get_llm_instance()
    
    # 최적화된 프롬프트: 더 간결하고 명확
    prompt = ChatPromptTemplate.from_template(
        """당신은 한신대학교 장학금 및 학사 규정 상담 전문가입니다.

[규정 정보]
{context}

[학생의 질문]
{question}

위의 규정 정보를 바탕으로 학생의 질문에 명확하고 친절하게 답변하세요.

답변 작성 규칙:
1. 규정 정보에 있는 내용만 사용하세요
2. 만약 정보가 없으면 "해당 내용을 찾을 수 없습니다"라고 말하세요
3. 답변은 3-4문장 이내로 간결하게 작성하세요
4. 중요한 세부사항(기한, 금액, 조건 등)은 반드시 포함하세요
5. 마지막에 "문의: 학생복지팀 031-379-0049"를 추가하세요"""
    )
    
    # 체인 구성
    chain = prompt | llm | StrOutputParser()
    
    # 답변 생성
    answer = chain.invoke({
        "context": context.strip(),
        "question": question.strip()
    })
    
    return answer.strip()
    
    # 답변 생성
    answer = chain.invoke({"context": context, "question": question})
    
    return answer
