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

def _format_search_results(results, max_length=3000):
    """
    검색 결과를 정제하고 포맷합니다.
    
    - 중복 제거
    - 최대 길이로 제한 (문장 단위로 자르기)
    - 출처 정보 유지
    """
    if isinstance(results, str):
        # 이미 문자열인 경우
        lines = results.split('\n')
        # 중복 라인 제거
        unique_lines = []
        seen = set()
        for line in lines:
            line_stripped = line.strip()
            # 빈 줄과 중복 제거
            if line_stripped and line_stripped not in seen:
                unique_lines.append(line)
                seen.add(line_stripped)
        
        # 길이 제한 (문장 단위로 자르기)
        text = '\n'.join(unique_lines)
        if len(text) > max_length:
            # 문장 단위로 자르기 (마지막 완전한 문장까지만)
            truncated = text[:max_length]
            last_period = truncated.rfind('.')
            last_newline = truncated.rfind('\n')
            cut_point = max(last_period, last_newline)
            if cut_point > max_length * 0.8:  # 너무 앞에서 자르지 않도록
                text = truncated[:cut_point + 1] + "\n..."
            else:
                text = truncated + "..."
        return text
    
    return results

@tool
def search_scholarship_rules(query: str) -> str:
    """
    한신대학교 장학금 및 학사 규정을 검색합니다.
    
    사용자의 질문(query)을 받아서, 
    Vector DB에서 관련된 규정 내용을 검색하여 문자열로 반환합니다.
    검색 결과는 최적화되어 있습니다.
    
    중요: 검색할 때는 질문 전체뿐만 아니라 핵심 키워드도 함께 사용하세요.
    예: "장학금 신청 기간" -> "장학금", "신청", "기간" 각각으로도 검색해보세요.
    
    Args:
        query (str): 검색할 질문 또는 키워드 (예: "장학금", "성적", "나눔장학금", "장학금 신청 기간")
        
    Returns:
        str: 검색된 규정 내용 (정제되고 최적화된 형식)
    """
    db = get_db_instance()
    
    # 개선된 검색 수행 (더 많은 결과, 낮은 threshold로 더 많은 컨텍스트 확보)
    # 복잡한 질문의 경우 더 많은 결과를 가져옴
    k_value = 10 if len(query.split()) > 3 else 8  # 긴 질문은 더 많은 결과
    raw_results = db.search(query, k=k_value, score_threshold=0.4)  # threshold를 더 낮춰서 더 많은 결과
    
    # 결과 최적화 (더 많은 컨텍스트 허용 - 복잡한 질문 대비)
    optimized_results = _format_search_results(raw_results, max_length=4000)  # 더 긴 컨텍스트
    
    return optimized_results
