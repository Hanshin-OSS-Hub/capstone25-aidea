# backend/agent/tools/generator.py

"""
답변 생성 도구: 검색된 규정과 질문을 합쳐 자연스러운 답변 작성
역할: 검색된 정보(Context)와 사용자의 질문(Query)을 받아서, 
       학생에게 말하듯 친절하게 답변을 작성합니다.
ReAct Agent가 호출할 수 있는 LangChain Tool로 구현됨.
"""

import os
from dotenv import load_dotenv
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
        _llm_instance = ChatOpenAI(model="gpt-4o", temperature=0)
    return _llm_instance

@tool
def generate_answer(context: str, question: str) -> str:
    """
    검색된 규정과 사용자 질문으로 최종 답변을 생성합니다.
    
    검색된 정보(context)와 사용자의 질문(question)을 받아서,
    자연스러운 한국어 답변을 생성합니다.
    
    Args:
        context (str): 벡터 DB에서 검색된 규정 내용
        question (str): 사용자의 원본 질문
        
    Returns:
        str: 생성된 최종 답변
    """
    llm = get_llm_instance()
    
    # 프롬프트 템플릿 정의
    prompt = ChatPromptTemplate.from_template(
        """
        당신은 한신대학교 장학금 및 학사 규정 전문 AI 어시스턴트입니다.
        아래의 [검색된 규정]을 바탕으로 학생의 질문에 친절하고 정확하게 답변하세요.
        
        1. 반드시 검색된 내용에 근거해서만 대답하세요.
        2. 검색된 내용에 답이 없다면 "죄송합니다. 해당 내용은 규정집에서 찾을 수 없습니다."라고 말하세요.
        3. 답변 끝에는 항상 출처(파일명)를 언급해주세요.
        
        [검색된 규정]
        {context}
        
        [질문]
        {question}
        """
    )
    
    # 체인 구성: 프롬프트 -> LLM -> 문자열 파서
    chain = prompt | llm | StrOutputParser()
    
    # 답변 생성
    answer = chain.invoke({"context": context, "question": question})
    
    return answer
