# backend/test_agent.py

"""
ReAct 에이전트 테스트 스크립트
"""

import sys
import os

# UTF-8 인코딩 설정
sys.stdout.reconfigure(encoding='utf-8')

# 프로젝트 루트를 경로에 추가
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from agent.agent import ScholarshipAgent

def test_agent():
    """에이전트 기본 동작 테스트 (최적화된 One-Shot 방식)"""
    print("=" * 70)
    print("🧪 최적화된 ReAct 에이전트 테스트 시작 (One-Shot 방식)")
    print("=" * 70)
    
    try:
        print("\n📌 1단계: 에이전트 초기화 중...")
        agent = ScholarshipAgent()
        print("✅ 에이전트 초기화 완료!")
        
        print("\n📌 2단계: 테스트 질문 실행")
        test_queries = [
            "한신대학교 장학금에 대해 설명해주세요",
            "나눔장학금의 지원 대상은?",
            "성적 기준은 무엇인가요?",
        ]
        
        for i, test_query in enumerate(test_queries, 1):
            print(f"\n   [{i}/{len(test_queries)}] 질문: {test_query}")
            print("   ⏳ 에이전트 실행 중... (검색 → LLM 답변)")
            
            try:
                response = agent.ask(test_query)
                print("\n   ✅ 답변 생성 완료!")
                print("   " + "-" * 66)
                # 줄바꿈 처리
                answer_lines = response.split('\n')
                for line in answer_lines:
                    print(f"   {line}")
                print("   " + "-" * 66)
            except Exception as query_error:
                print(f"   ❌ 이 질문 처리 실패: {str(query_error)}")
        
        print("\n" + "=" * 70)
        print("✅ 모든 테스트 완료!")
        print("=" * 70)
        return True
    
    except Exception as e:
        print(f"\n❌ 테스트 실패: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_agent()
    sys.exit(0 if success else 1)
