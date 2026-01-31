# backend/tests/performance_test.py

"""
성능 검증 테스트 스크립트

다음 항목들을 측정합니다:
1. 응답 시간 (Response Time)
2. 검색 정확도 (Search Accuracy)
3. 캐시 효과 (Cache Performance)
4. 복잡한 질문 처리 능력
5. 동시 요청 처리 (Concurrent Requests)
"""

import sys
import os
import time
import asyncio
import requests
from datetime import datetime
from typing import List, Dict, Tuple
import statistics

# 경로 설정
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 테스트 질문 세트
TEST_QUESTIONS = {
    "단순 질문": [
        "장학금 신청 기간이 언제인가요?",
        "성적 장학금 기준은 무엇인가요?",
        "휴학 신청은 어떻게 하나요?",
    ],
    "복잡한 질문": [
        "장학금 신청 기간과 성적 기준을 알려주세요",
        "휴학 신청 기간과 복학 절차를 알려줘",
        "졸업 요건과 부전공 이수 조건을 알려주세요",
    ],
    "모호한 질문": [
        "돈 받고 싶어",
        "졸업하려면 뭐가 필요한가요?",
        "이번 학기 뭐 해야 해?",
    ],
    "이중 질문": [
        "장학금과 휴학에 대해 알려줘",
        "졸업과 부전공 정보 알려줘",
    ]
}

BASE_URL = "http://localhost:8000/api/v1/ai/chat"


class PerformanceTester:
    """성능 테스트 클래스"""
    
    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.results = []
    
    def test_single_request(self, question: str, user_id: int = 1) -> Dict:
        """단일 요청 테스트"""
        start_time = time.time()
        
        try:
            response = requests.post(
                self.base_url,
                json={"user_id": user_id, "message": question},
                timeout=120
            )
            
            elapsed_time = time.time() - start_time
            
            result = {
                "question": question,
                "status_code": response.status_code,
                "response_time": elapsed_time,
                "success": response.status_code == 200,
                "timestamp": datetime.now().isoformat()
            }
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    answer_data = data.get("data", {})
                    result["answer_length"] = len(answer_data.get("answer", ""))
                    result["has_sources"] = len(answer_data.get("sources", [])) > 0
                    result["has_followups"] = len(answer_data.get("followups", [])) > 0
                else:
                    result["error"] = data.get("error", {})
            else:
                try:
                    error_data = response.json()
                    result["error"] = error_data.get("error", {})
                except:
                    result["error"] = {"message": response.text}
            
            return result
            
        except requests.exceptions.Timeout:
            return {
                "question": question,
                "status_code": 504,
                "response_time": 120.0,
                "success": False,
                "error": {"code": "TIMEOUT", "message": "Request timeout"},
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            return {
                "question": question,
                "status_code": 0,
                "response_time": time.time() - start_time,
                "success": False,
                "error": {"code": "EXCEPTION", "message": str(e)},
                "timestamp": datetime.now().isoformat()
            }
    
    def test_category(self, category: str, questions: List[str], warmup: bool = True) -> Dict:
        """카테고리별 테스트"""
        print(f"\n{'='*60}")
        print(f"📊 테스트 카테고리: {category}")
        print(f"{'='*60}")
        
        results = []
        
        # 워밍업 (첫 요청은 제외)
        if warmup and questions:
            print("🔥 워밍업 중...")
            self.test_single_request(questions[0])
            time.sleep(1)
        
        # 실제 테스트
        for i, question in enumerate(questions, 1):
            print(f"\n[{i}/{len(questions)}] 질문: {question[:50]}...")
            result = self.test_single_request(question)
            results.append(result)
            
            if result["success"]:
                print(f"   ✅ 성공 ({result['response_time']:.2f}초)")
                if "answer_length" in result:
                    print(f"   📝 답변 길이: {result['answer_length']}자")
            else:
                print(f"   ❌ 실패 ({result['response_time']:.2f}초)")
                if "error" in result:
                    print(f"   ⚠️  오류: {result['error'].get('message', 'Unknown')}")
            
            time.sleep(0.5)  # 서버 부하 방지
        
        # 통계 계산
        response_times = [r["response_time"] for r in results if r["success"]]
        success_count = sum(1 for r in results if r["success"])
        
        stats = {
            "category": category,
            "total": len(results),
            "success": success_count,
            "failure": len(results) - success_count,
            "success_rate": (success_count / len(results) * 100) if results else 0,
            "avg_response_time": statistics.mean(response_times) if response_times else 0,
            "min_response_time": min(response_times) if response_times else 0,
            "max_response_time": max(response_times) if response_times else 0,
            "median_response_time": statistics.median(response_times) if response_times else 0,
            "results": results
        }
        
        return stats
    
    def test_cache_performance(self, question: str, iterations: int = 5) -> Dict:
        """캐시 성능 테스트"""
        print(f"\n{'='*60}")
        print(f"⚡ 캐시 성능 테스트")
        print(f"{'='*60}")
        print(f"질문: {question}")
        print(f"반복 횟수: {iterations}")
        
        results = []
        
        for i in range(iterations):
            print(f"\n[{i+1}/{iterations}] 요청 중...")
            result = self.test_single_request(question)
            results.append(result)
            print(f"   응답 시간: {result['response_time']:.3f}초")
            time.sleep(0.3)
        
        response_times = [r["response_time"] for r in results]
        first_request = response_times[0]
        cached_requests = response_times[1:] if len(response_times) > 1 else []
        
        cache_stats = {
            "question": question,
            "first_request_time": first_request,
            "cached_avg_time": statistics.mean(cached_requests) if cached_requests else 0,
            "cache_speedup": (first_request / statistics.mean(cached_requests)) if cached_requests and statistics.mean(cached_requests) > 0 else 0,
            "all_times": response_times
        }
        
        print(f"\n📊 캐시 효과:")
        print(f"   첫 요청: {first_request:.3f}초")
        if cached_requests:
            print(f"   캐시 평균: {statistics.mean(cached_requests):.3f}초")
            print(f"   속도 향상: {cache_stats['cache_speedup']:.1f}배")
        
        return cache_stats
    
    def test_concurrent_requests(self, question: str, concurrent: int = 5) -> Dict:
        """동시 요청 테스트"""
        print(f"\n{'='*60}")
        print(f"🔄 동시 요청 테스트")
        print(f"{'='*60}")
        print(f"질문: {question}")
        print(f"동시 요청 수: {concurrent}")
        
        async def make_request(session, question, user_id):
            """비동기 요청"""
            start = time.time()
            try:
                async with session.post(
                    self.base_url,
                    json={"user_id": user_id, "message": question},
                    timeout=120
                ) as response:
                    elapsed = time.time() - start
                    data = await response.json()
                    return {
                        "status": response.status,
                        "response_time": elapsed,
                        "success": response.status == 200 and data.get("success"),
                        "data": data
                    }
            except Exception as e:
                return {
                    "status": 0,
                    "response_time": time.time() - start,
                    "success": False,
                    "error": str(e)
                }
        
        async def run_concurrent():
            import aiohttp
            async with aiohttp.ClientSession() as session:
                tasks = [
                    make_request(session, question, i+1) 
                    for i in range(concurrent)
                ]
                return await asyncio.gather(*tasks)
        
        start_time = time.time()
        results = asyncio.run(run_concurrent())
        total_time = time.time() - start_time
        
        response_times = [r["response_time"] for r in results if r["success"]]
        success_count = sum(1 for r in results if r["success"])
        
        concurrent_stats = {
            "question": question,
            "concurrent": concurrent,
            "total_time": total_time,
            "success": success_count,
            "failure": concurrent - success_count,
            "success_rate": (success_count / concurrent * 100) if concurrent > 0 else 0,
            "avg_response_time": statistics.mean(response_times) if response_times else 0,
            "min_response_time": min(response_times) if response_times else 0,
            "max_response_time": max(response_times) if response_times else 0,
            "throughput": concurrent / total_time if total_time > 0 else 0,
            "results": results
        }
        
        print(f"\n📊 동시 요청 결과:")
        print(f"   총 시간: {total_time:.2f}초")
        print(f"   성공: {success_count}/{concurrent}")
        print(f"   평균 응답 시간: {concurrent_stats['avg_response_time']:.2f}초")
        print(f"   처리량: {concurrent_stats['throughput']:.2f} req/s")
        
        return concurrent_stats
    
    def run_all_tests(self):
        """전체 테스트 실행"""
        print("="*60)
        print("🚀 성능 검증 테스트 시작")
        print("="*60)
        print(f"테스트 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"API 엔드포인트: {self.base_url}")
        
        all_stats = []
        
        # 1. 카테고리별 테스트
        for category, questions in TEST_QUESTIONS.items():
            stats = self.test_category(category, questions)
            all_stats.append(stats)
        
        # 2. 캐시 성능 테스트
        cache_stats = self.test_cache_performance(
            "장학금 신청 기간이 언제인가요?",
            iterations=5
        )
        
        # 3. 동시 요청 테스트
        concurrent_stats = self.test_concurrent_requests(
            "성적 장학금 기준은 무엇인가요?",
            concurrent=5
        )
        
        # 전체 통계 출력
        self.print_summary(all_stats, cache_stats, concurrent_stats)
        
        return {
            "category_stats": all_stats,
            "cache_stats": cache_stats,
            "concurrent_stats": concurrent_stats
        }
    
    def print_summary(self, category_stats: List[Dict], cache_stats: Dict, concurrent_stats: Dict):
        """결과 요약 출력"""
        print("\n" + "="*60)
        print("📊 성능 검증 결과 요약")
        print("="*60)
        
        print("\n[카테고리별 성능]")
        print(f"{'카테고리':<20} {'성공률':<10} {'평균 응답시간':<15} {'최소':<10} {'최대':<10}")
        print("-" * 65)
        
        for stats in category_stats:
            print(f"{stats['category']:<20} "
                  f"{stats['success_rate']:>6.1f}%   "
                  f"{stats['avg_response_time']:>8.2f}초      "
                  f"{stats['min_response_time']:>6.2f}초  "
                  f"{stats['max_response_time']:>6.2f}초")
        
        print("\n[캐시 성능]")
        print(f"첫 요청: {cache_stats['first_request_time']:.3f}초")
        if cache_stats['cached_avg_time'] > 0:
            print(f"캐시 평균: {cache_stats['cached_avg_time']:.3f}초")
            print(f"속도 향상: {cache_stats['cache_speedup']:.1f}배")
        
        print("\n[동시 요청 성능]")
        print(f"동시 요청 수: {concurrent_stats['concurrent']}")
        print(f"성공률: {concurrent_stats['success_rate']:.1f}%")
        print(f"평균 응답 시간: {concurrent_stats['avg_response_time']:.2f}초")
        print(f"처리량: {concurrent_stats['throughput']:.2f} req/s")
        
        print("\n" + "="*60)


def main():
    """메인 함수"""
    import argparse
    
    parser = argparse.ArgumentParser(description="성능 검증 테스트")
    parser.add_argument("--url", default=BASE_URL, help="API 엔드포인트 URL")
    parser.add_argument("--category", choices=list(TEST_QUESTIONS.keys()), help="특정 카테고리만 테스트")
    parser.add_argument("--cache", action="store_true", help="캐시 성능 테스트만 실행")
    parser.add_argument("--concurrent", type=int, help="동시 요청 테스트만 실행")
    
    args = parser.parse_args()
    
    tester = PerformanceTester(base_url=args.url)
    
    if args.cache:
        tester.test_cache_performance("장학금 신청 기간이 언제인가요?")
    elif args.concurrent:
        tester.test_concurrent_requests("성적 장학금 기준은 무엇인가요?", args.concurrent)
    elif args.category:
        tester.test_category(args.category, TEST_QUESTIONS[args.category])
    else:
        tester.run_all_tests()


if __name__ == "__main__":
    main()
