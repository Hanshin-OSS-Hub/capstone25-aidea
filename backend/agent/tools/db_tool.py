# backend/agent/tools/db_tool.py

# 팀장님이 만든 VectorDB 가져오기
from backend.config.internal_vdb.vectordb import SchoolVectorDB

# DB를 한 번만 로딩하기 위해 전역 변수로 선언
db_instance = SchoolVectorDB()

def search_scholarship_rule(query: str):
    """
    사용자의 질문(query)을 받아서, 
    Vector DB에서 관련된 규정 내용을 검색하여 문자열로 반환합니다.
    """
    # 아까 만든 search 함수 사용
    results = db_instance.search(query)
    return results