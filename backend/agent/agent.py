# backend/agent/agent.py

import os
import sys

# 경로 설정 (에러 방지용)
sys.path.append(os.path.dirname(os.path.abspath(os.path.dirname(os.path.dirname(__file__)))))

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser

# 팀장님이 만든 DB 가져오기
from backend.config.internal_vdb.vectordb import SchoolVectorDB

load_dotenv()

class ScholarshipAgent:
    def __init__(self):
        # 1. 벡터 DB 연결
        self.db = SchoolVectorDB()
        self.retriever = self.db.vector_store.as_retriever(search_kwargs={"k": 3})

        # 2. 두뇌(LLM) 설정
        self.llm = ChatOpenAI(model="gpt-4o", temperature=0)

        # 3. 프롬프트(지시사항) 설정
        self.prompt = ChatPromptTemplate.from_template(
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

        # 4. 체인 연결 (검색 -> 프롬프트 -> GPT -> 답변)
        self.chain = (
            {"context": self.retriever, "question": RunnablePassthrough()}
            | self.prompt
            | self.llm
            | StrOutputParser()
        )

    def ask(self, query: str):
        """질문을 받아 답변을 반환하는 함수"""
        if not query:
            return "질문을 입력해주세요."
        
        # 간단한 체인 실행
        return self.chain.invoke(query)

# 테스트 실행
if __name__ == "__main__":
    bot = ScholarshipAgent()
    print("🤖 AI 비서가 준비되었습니다. (초기 버전 복구 완료!)")
    
    while True:
        user_input = input("\n질문: ")
        if user_input.lower() == "exit":
            break
        
        response = bot.ask(user_input)
        print(f"답변: {response}")