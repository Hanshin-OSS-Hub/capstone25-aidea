# backend/agent/tools/search.py

"""
검색 도구: 벡터 DB에서 규정 검색 (최적화 버전)
역할: SchoolVectorDB에 접속해서 질문(Query)과 관련된 문서를 찾아옵니다.
ReAct Agent가 호출할 수 있는 LangChain Tool로 구현됨.
"""

from langchain_core.tools import tool
import sys
import os

# 경로 설정
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from config.internal_vdb.vectordb import SchoolVectorDB

# DB를 한 번만 로딩하기 위해 싱글톤으로 관리
_db_instance = None

def get_db_instance():
    """벡터 DB 인스턴스를 싱글톤으로 관리"""
    global _db_instance
    if _db_instance is None:
        _db_instance = SchoolVectorDB()
    return _db_instance

def _format_search_results(results, max_length=1500):
    """
    검색 결과를 정제하고 포맷합니다.
    
    - 중복 제거
    - 최대 길이로 제한
    - 출처 정보 추가
    """
    if isinstance(results, str):
        # 이미 문자열인 경우
        lines = results.split('\n')
        # 중복 라인 제거
        unique_lines = []
        seen = set()
        for line in lines:
            line_stripped = line.strip()
            if line_stripped and line_stripped not in seen:
                unique_lines.append(line)
                seen.add(line_stripped)
        
        # 길이 제한
        text = '\n'.join(unique_lines)
        if len(text) > max_length:
            text = text[:max_length] + "..."
        return text
    
    return results

@tool
def search_scholarship_rules(query: str) -> str:
    """
    한신대학교 장학금 및 학사 규정을 검색합니다.
    
    사용자의 질문(query)을 받아서, 
    Vector DB에서 관련된 규정 내용을 검색하여 문자열로 반환합니다.
    검색 결과는 최적화되어 있습니다.
    
    Args:
        query (str): 검색할 질문 또는 키워드 (예: "장학금", "성적", "나눔장학금")
        
    Returns:
        str: 검색된 규정 내용 (정제되고 최적화된 형식)
    """
    db = get_db_instance()
    
    # 원본 검색 수행
    raw_results = db.search(query)
    
    # 결과 최적화
    optimized_results = _format_search_results(raw_results, max_length=1500)
    
    return optimized_results
