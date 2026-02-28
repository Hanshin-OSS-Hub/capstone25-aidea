"""
공지사항 AI 분석 서비스 (단일 공지 온디맨드)
"""

import json
import os
from datetime import datetime

from sqlalchemy.orm import Session

from backend.models import Notice, NoticeAIField
from langchain_openai import ChatOpenAI


def analyze_notice(db: Session, notice_id: int) -> bool:
    """
    단일 공지사항 AI 분석 후 DB 저장
    
    Returns:
        업데이트된 공지 상세 정보 또는 None (공지 없음)
    """
    notice = db.query(Notice).filter(Notice.notice_id == notice_id).first()
    if not notice:
        return False

    if not os.getenv("OPENAI_API_KEY"):
        raise ValueError("OPENAI_API_KEY가 설정되지 않았습니다.")

    llm = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0,
        max_tokens=1000
    )

    prompt = f"""
다음 공지사항을 분석하여 JSON 형식으로 정보를 추출해주세요.

[공지사항]
제목: {notice.title}
카테고리: {notice.category_name or notice.category}
내용:
{notice.content[:1500]}

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

        if '```json' in content:
            content = content.split('```json')[1].split('```')[0].strip()
        elif '```' in content:
            content = content.split('```')[1].split('```')[0].strip()

        result = json.loads(content)

        # 날짜 변환
        start_date = None
        if result.get('start_date'):
            try:
                start_date = datetime.strptime(result['start_date'], '%Y-%m-%d').date()
            except (ValueError, TypeError):
                pass

        end_date = None
        if result.get('end_date'):
            try:
                end_date = datetime.strptime(result['end_date'], '%Y-%m-%d').date()
            except (ValueError, TypeError):
                pass

        # 기존 AI 필드 업데이트 또는 새로 생성
        ai_field = db.query(NoticeAIField).filter(NoticeAIField.notice_id == notice_id).first()
        if ai_field:
            ai_field.summary = result.get('summary', [])
            ai_field.ai_category = result.get('ai_category')
            ai_field.start_date = start_date
            ai_field.end_date = end_date
            ai_field.extracted_json = result.get('key_info', {})
            ai_field.status = 'success'
            ai_field.error_message = None
            ai_field.analyzed_at = datetime.utcnow()
        else:
            ai_field = NoticeAIField(
                notice_id=notice_id,
                summary=result.get('summary', []),
                ai_category=result.get('ai_category'),
                start_date=start_date,
                end_date=end_date,
                extracted_json=result.get('key_info', {}),
                status='success',
                analyzed_at=datetime.utcnow()
            )
            db.add(ai_field)

        db.commit()
        return True

    except Exception as e:
        db.rollback()
        # 실패 시에도 기록
        ai_field = db.query(NoticeAIField).filter(NoticeAIField.notice_id == notice_id).first()
        if ai_field:
            ai_field.status = 'fail'
            ai_field.error_message = str(e)[:500]
            ai_field.analyzed_at = datetime.utcnow()
        else:
            ai_field = NoticeAIField(
                notice_id=notice_id,
                status='fail',
                error_message=str(e)[:500],
                analyzed_at=datetime.utcnow()
            )
            db.add(ai_field)
        db.commit()
        raise
