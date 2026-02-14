#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
데이터베이스 테이블 삭제 및 재생성
"""

import sys
import os

# Windows 터미널 인코딩 설정
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 경로 설정 (scripts/ → 프로젝트 루트)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import engine, Base, SessionLocal, text
from backend.models import Notice, NoticeAIField, FavoriteNotice, CalendarEvent, User


def drop_all_tables():
    """모든 테이블 삭제 (CASCADE 사용)"""
    print("⚠️  모든 테이블을 삭제합니다...")
    db = SessionLocal()
    try:
        # 테이블 목록
        tables = ['activity_history', 'calendar_events', 'favorite_notices', 'notice_ai_fields', 'notices', 'users']
        
        for table in tables:
            try:
                db.execute(text(f"DROP TABLE IF EXISTS {table} CASCADE"))
                print(f"  ✓ {table} 삭제")
            except Exception as e:
                print(f"  ⚠ {table} 삭제 실패: {e}")
        
        db.commit()
        print("✅ 모든 테이블이 삭제되었습니다.")
        return True
    except Exception as e:
        db.rollback()
        print(f"❌ 테이블 삭제 실패: {e}")
        return False
    finally:
        db.close()


def create_all_tables():
    """모든 테이블 생성"""
    print("📋 모든 테이블을 생성합니다...")
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ 모든 테이블이 생성되었습니다!")
        
        # 생성된 테이블 목록 출력
        print("\n📋 생성된 테이블:")
        for table in Base.metadata.sorted_tables:
            print(f"  - {table.name}")
            # 칼럼 정보 출력
            for column in table.columns:
                print(f"      · {column.name} ({column.type})")
        
        return True
    except Exception as e:
        print(f"❌ 테이블 생성 실패: {e}")
        return False


def main():
    print("="*60)
    print("데이터베이스 테이블 재생성")
    print("="*60)
    print()
    
    # 1. 테이블 삭제
    if not drop_all_tables():
        return
    print()
    
    # 2. 테이블 생성
    if not create_all_tables():
        return
    print()
    
    print("="*60)
    print("✅ 데이터베이스 재생성 완료!")
    print("="*60)


if __name__ == "__main__":
    main()
