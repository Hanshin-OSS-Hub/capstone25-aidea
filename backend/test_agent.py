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
    """에이전트 기본 동작 테스트"""
    print("=" * 60)
    print("🧪 ReAct 에이전트 테스트 시작")
    print("=" * 60)
    
    try:
        print("\n✅ 1단계: 에이전트 초기화 중...")
        agent = ScholarshipAgent()
        print("✅ 에이전트 초기화 완료!")
        
        print("\n✅ 2단계: 도구 확인")
        print(f"   - 사용 가능한 도구 수: {len(agent.tools)}")
        for tool in agent.tools:
            print(f"     • {tool.name}: {tool.description[:50]}...")
        
        print("\n✅ 3단계: 테스트 질문 실행")
        test_query = "한신대학교 장학금에 대해 설명해주세요"
        print(f"   질문: {test_query}")
        
        print("\n   ⏳ 에이전트 실행 중... (검색 → 답변 생성)")
        response = agent.ask(test_query)
        
        print("\n✅ 답변 생성 완료!")
        print("-" * 60)
        print(f"📝 답변:\n{response}")
        print("-" * 60)
        
        print("\n✅ 테스트 완료!")
        return True
    
    except Exception as e:
        print(f"\n❌ 테스트 실패: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_agent()
    sys.exit(0 if success else 1)
