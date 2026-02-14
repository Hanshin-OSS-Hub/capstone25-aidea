#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
데이터베이스 초기화 스크립트
- DB 연결 테스트
- 테이블 생성
- 테스트 데이터 삽입 (옵션)
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

from backend.database import engine, Base, test_connection, SessionLocal
from backend.models import Notice, NoticeAIField, FavoriteNotice, CalendarEvent, User


def create_tables():
    """모든 테이블 생성"""
    print("="*60)
    print("데이터베이스 테이블 생성")
    print("="*60)
    
    try:
        # 모든 테이블 생성
        Base.metadata.create_all(bind=engine)
        print("✅ 모든 테이블이 성공적으로 생성되었습니다!")
        
        # 생성된 테이블 목록 출력
        print("\n📋 생성된 테이블:")
        for table in Base.metadata.sorted_tables:
            print(f"  - {table.name}")
        
        return True
    except Exception as e:
        print(f"❌ 테이블 생성 실패: {e}")
        return False


def create_test_user():
    """테스트 사용자 생성"""
    db = SessionLocal()
    try:
        # 이미 존재하는지 확인
        existing_user = db.query(User).filter(User.user_id == 1).first()
        if existing_user:
            print("ℹ️  테스트 사용자가 이미 존재합니다.")
            return
        
        # 테스트 사용자 생성
        test_user = User(
            user_id=1,
            username="test_user",
            name="테스트 사용자",
            email="test@hanshin.ac.kr",
            school="한신대학교",
            grade=3
        )
        db.add(test_user)
        db.commit()
        print("✅ 테스트 사용자 생성 완료 (user_id=1)")
    except Exception as e:
        print(f"❌ 테스트 사용자 생성 실패: {e}")
        db.rollback()
    finally:
        db.close()


def main():
    print("\n🚀 데이터베이스 초기화를 시작합니다...\n")
    
    # 1. DB 연결 테스트
    print("1️⃣  데이터베이스 연결 테스트")
    if not test_connection():
        print("\n❌ DB 연결에 실패했습니다. .env 파일의 설정을 확인해주세요.")
        return
    print()
    
    # 2. 테이블 생성
    print("2️⃣  테이블 생성")
    if not create_tables():
        return
    print()
    
    # 3. 테스트 사용자 생성
    print("3️⃣  테스트 데이터 생성")
    create_test_user()
    print()
    
    print("="*60)
    print("✅ 데이터베이스 초기화 완료!")
    print("="*60)


if __name__ == "__main__":
    main()
