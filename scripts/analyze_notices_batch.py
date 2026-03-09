#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
공지사항 AI 분석 배치 처리
- GPT-4로 공지사항 요약 및 정보 추출
- notice_ai_fields 테이블에 저장
"""

import sys
import os
import json
import re
from datetime import datetime, date
from typing import Dict, List, Optional, Tuple

# Windows 터미널 인코딩 설정
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 경로 설정 (scripts/ → 프로젝트 루트)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal
from backend.models import Notice, NoticeAIField
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv

load_dotenv()


def create_llm():
    """GPT-4 LLM 생성"""
    return ChatOpenAI(
        model="gpt-4o-mini",  # 비용 절감을 위해 mini 사용
        temperature=0,
        max_tokens=1000
    )


def analyze_notice(llm, notice: Notice) -> Dict:
    """
    단일 공지사항 AI 분석
    """
    prompt = f"""
다음 공지사항을 분석하여 JSON 형식으로 정보를 추출해주세요.

[공지사항]
제목: {notice.title}
카테고리: {notice.category_name}
내용:
{notice.content[:1500]}  # 너무 길면 잘라서 전송

[추출할 정보]
1. summary: 3줄 요약 (각 줄은 핵심 내용 한 문장, 배열로 반환)
2. ai_category: 자동 분류된 카테고리 ("장학금", "학사", "행사", "취업", "일반" 중 하나)
3. start_date: 시작일 (YYYY-MM-DD 형식, 없으면 null)
4. end_date: 마감일/종료일 (YYYY-MM-DD 형식, 없으면 null)
5. key_info: 중요 정보 (대상, 장소, 문의처 등)

반드시 다음 JSON 형식으로만 응답하세요:
{{
  "summary": ["첫 번째 줄", "두 번째 줄", "세 번째 줄"],
  "ai_category": "카테고리명",
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "key_info": {{
    "target": "대상",
    "location": "장소",
    "contact": "문의처"
  }}
}}

주의사항:
- 날짜는 반드시 YYYY-MM-DD 형식으로
- 날짜 정보가 없으면 null 사용
- 2026년, 26년 등의 표현을 2026-으로 변환
- "~" 또는 "까지" 표현이 있으면 end_date로 추출
"""
    
    try:
        response = llm.invoke(prompt)
        content = response.content.strip()
        
        # JSON 추출 (```json ``` 태그 제거)
        if '```json' in content:
            content = content.split('```json')[1].split('```')[0].strip()
        elif '```' in content:
            content = content.split('```')[1].split('```')[0].strip()
        
        result = json.loads(content)
        
        # 날짜 검증 및 변환
        if result.get('start_date'):
            try:
                result['start_date'] = datetime.strptime(result['start_date'], '%Y-%m-%d').date()
            except:
                result['start_date'] = None
        
        if result.get('end_date'):
            try:
                result['end_date'] = datetime.strptime(result['end_date'], '%Y-%m-%d').date()
            except:
                result['end_date'] = None
        
        return result
        
    except Exception as e:
        print(f"    ⚠ 분석 실패: {str(e)[:100]}")
        return None


def process_all_notices(limit: Optional[int] = None):
    """모든 공지사항 AI 분석"""
    db = SessionLocal()
    
    try:
        # AI 분석되지 않은 공지사항 가져오기
        query = db.query(Notice).outerjoin(NoticeAIField).filter(NoticeAIField.id == None)
        
        if limit:
            query = query.limit(limit)
        
        notices = query.all()
        
        print(f"📄 총 {len(notices)}개 공지사항 AI 분석 시작...")
        print(f"⏳ 예상 소요 시간: 약 {len(notices) * 3}초")
        print()
        
        # LLM 생성
        llm = create_llm()
        
        success_count = 0
        fail_count = 0
        
        for idx, notice in enumerate(notices, 1):
            print(f"[{idx}/{len(notices)}] {notice.title[:40]}...")
            
            # AI 분석
            result = analyze_notice(llm, notice)
            
            if result:
                # notice_ai_fields에 저장
                ai_field = NoticeAIField(
                    notice_id=notice.notice_id,
                    summary=result.get('summary', []),
                    ai_category=result.get('ai_category'),
                    start_date=result.get('start_date'),
                    end_date=result.get('end_date'),
                    extracted_json=result.get('key_info', {}),
                    status='success',
                    analyzed_at=datetime.utcnow()
                )
                db.add(ai_field)
                success_count += 1
                print(f"    ✓ 완료 (요약: {len(result.get('summary', []))}줄, 마감일: {result.get('end_date')})")
            else:
                # 실패한 경우에도 기록
                ai_field = NoticeAIField(
                    notice_id=notice.notice_id,
                    status='fail',
                    error_message='AI 분석 실패',
                    analyzed_at=datetime.utcnow()
                )
                db.add(ai_field)
                fail_count += 1
            
            # 10개마다 커밋
            if idx % 10 == 0:
                db.commit()
                print(f"\n  💾 {idx}개 저장 완료...\n")
        
        # 최종 커밋
        db.commit()
        
        print()
        print(f"{'='*60}")
        print(f"✅ AI 분석 완료!")
        print(f"  - 성공: {success_count}개")
        print(f"  - 실패: {fail_count}개")
        print(f"{'='*60}")
        
        # 샘플 출력
        if success_count > 0:
            sample = db.query(Notice).join(NoticeAIField).filter(
                NoticeAIField.status == 'success'
            ).first()
            
            if sample and sample.ai_field:
                print("\n📋 분석 예시:")
                print(f"\n제목: {sample.title}")
                print(f"카테고리: {sample.ai_field.ai_category}")
                if sample.ai_field.start_date:
                    print(f"시작일: {sample.ai_field.start_date}")
                if sample.ai_field.end_date:
                    print(f"마감일: {sample.ai_field.end_date}")
                if sample.ai_field.summary:
                    print(f"\n요약:")
                    for i, line in enumerate(sample.ai_field.summary, 1):
                        print(f"  {i}. {line}")
        
    except Exception as e:
        db.rollback()
        print(f"❌ AI 분석 실패: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


def main():
    print("="*60)
    print("공지사항 AI 분석 배치 처리")
    print("="*60)
    print()
    
    # OpenAI API 키 확인
    if not os.getenv("OPENAI_API_KEY"):
        print("❌ .env 파일에 OPENAI_API_KEY가 설정되지 않았습니다!")
        return
    
    # 전체 공지사항 분석 (테스트: limit=5로 제한 가능)
    # process_all_notices(limit=5)  # 테스트용
    process_all_notices()  # 전체 분석


if __name__ == "__main__":
    main()
