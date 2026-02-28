#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
공지사항 텍스트 정제 전처리
- AI Agent가 검색하기 좋게 텍스트 정리
- 불필요한 공백, 특수문자 제거
"""

import sys
import os
import re

# Windows 터미널 인코딩 설정
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 경로 설정 (scripts/ → 프로젝트 루트)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal
from backend.models import Notice


def clean_text(text: str) -> str:
    """
    텍스트 정제 함수
    """
    if not text:
        return ""
    
    # 1. 특수문자 정리
    # □, ㅇ, ※ 등을 제거 또는 변환
    text = text.replace('□', '• ')
    text = text.replace('ㅇ', '• ')
    text = text.replace('※', '[주의] ')
    text = text.replace('▪', '• ')
    text = text.replace('▶', '• ')
    text = text.replace('◆', '• ')
    text = text.replace('◇', '• ')
    text = text.replace('●', '• ')
    text = text.replace('○', '• ')
    
    # 2. 연속된 공백/줄바꿈 제거
    # 연속된 줄바꿈을 2개로 제한
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    # 연속된 공백을 1개로
    text = re.sub(r' {2,}', ' ', text)
    
    # 탭을 공백으로
    text = text.replace('\t', ' ')
    
    # 3. 이상한 인코딩 문자 제거 (제어 문자 등)
    # 줄바꿈, 탭을 제외한 제어 문자 제거
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    
    # 4. 줄 시작/끝 공백 제거
    lines = text.split('\n')
    lines = [line.strip() for line in lines]
    text = '\n'.join(lines)
    
    # 5. 빈 줄이 연속으로 나오지 않도록
    text = re.sub(r'\n\n+', '\n\n', text)
    
    # 6. 앞뒤 공백 제거
    text = text.strip()
    
    return text


def preprocess_all_notices():
    """모든 공지사항 텍스트 정제"""
    db = SessionLocal()
    
    try:
        # 모든 공지사항 가져오기
        notices = db.query(Notice).all()
        
        print(f"📄 총 {len(notices)}개 공지사항 전처리 시작...")
        print()
        
        processed_count = 0
        unchanged_count = 0
        
        for notice in notices:
            original_content = notice.content
            cleaned_content = clean_text(original_content)
            
            # 변경사항이 있으면 업데이트
            if cleaned_content != original_content:
                notice.content = cleaned_content
                processed_count += 1
                
                # 진행 상황 출력 (10개마다)
                if processed_count % 10 == 0:
                    print(f"  ✓ {processed_count}개 처리 중...")
            else:
                unchanged_count += 1
        
        # 변경사항 저장
        db.commit()
        
        print()
        print(f"{'='*60}")
        print(f"✅ 텍스트 정제 완료!")
        print(f"  - 처리됨: {processed_count}개")
        print(f"  - 변경없음: {unchanged_count}개")
        print(f"{'='*60}")
        
        # 샘플 출력 (첫 번째 처리된 공지)
        if processed_count > 0:
            print("\n📋 처리 예시 (첫 번째 공지):")
            sample_notice = db.query(Notice).filter(Notice.content != "").first()
            if sample_notice:
                print(f"\n제목: {sample_notice.title}")
                print(f"\n내용 (앞부분):")
                print(sample_notice.content[:300] + "..." if len(sample_notice.content) > 300 else sample_notice.content)
        
    except Exception as e:
        db.rollback()
        print(f"❌ 전처리 실패: {e}")
    finally:
        db.close()


def main():
    print("="*60)
    print("공지사항 텍스트 정제 전처리")
    print("="*60)
    print()
    
    preprocess_all_notices()


if __name__ == "__main__":
    main()
