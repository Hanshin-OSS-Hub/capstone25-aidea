#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
크롤링된 공지사항 데이터를 DB에 적재하는 스크립트
"""

import sys
import os
import json
import glob
from datetime import datetime

# Windows 터미널 인코딩 설정
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 경로 설정 (scripts/ → 프로젝트 루트)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal
from backend.models import Notice


def load_json_files():
    """크롤링 데이터 JSON 파일 로드"""
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    notices_dir = os.path.join(project_root, "crawler", "crawling", "data", "notices")
    
    # JSON 파일 찾기 (manifest.json, processed_uids.json 제외)
    json_files = glob.glob(os.path.join(notices_dir, "*.json"))
    json_files = [f for f in json_files if not f.endswith(('manifest.json', 'processed_uids.json'))]
    
    all_notices = []
    for json_file in json_files:
        filename = os.path.basename(json_file)
        print(f"📄 읽는 중: {filename}")
        
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                all_notices.extend(data)
                print(f"   ✓ {len(data)}개 공지사항 로드")
        except Exception as e:
            print(f"   ✗ 오류: {e}")
    
    print(f"\n✅ 총 {len(all_notices)}개 공지사항 로드 완료")
    return all_notices


def insert_notices(notices_data):
    """공지사항 데이터를 DB에 삽입"""
    db = SessionLocal()
    
    try:
        inserted_count = 0
        skipped_count = 0
        error_count = 0
        
        for data in notices_data:
            try:
                # 이미 존재하는지 확인 (uid 기준)
                existing = db.query(Notice).filter(Notice.uid == data['uid']).first()
                if existing:
                    skipped_count += 1
                    continue
                
                # 날짜 파싱
                posted_date = None
                if data.get('posted_date'):
                    try:
                        posted_date = datetime.strptime(data['posted_date'], '%Y-%m-%d').date()
                    except:
                        pass
                
                crawled_at = None
                if data.get('crawled_at'):
                    try:
                        crawled_at = datetime.fromisoformat(data['crawled_at'].replace('Z', '+00:00'))
                    except:
                        crawled_at = datetime.utcnow()
                
                # Notice 객체 생성
                notice = Notice(
                    uid=data['uid'],
                    title=data['title'],
                    content=data.get('content_text', ''),
                    category=data.get('category', 'general'),
                    category_name=data.get('category_name', ''),
                    original_url=data.get('url', ''),
                    posted_date=posted_date,
                    crawled_at=crawled_at,
                    has_attachment=len(data.get('attachments', [])) > 0
                )
                
                db.add(notice)
                inserted_count += 1
                
                # 100개마다 커밋
                if inserted_count % 100 == 0:
                    db.commit()
                    print(f"  💾 {inserted_count}개 저장...")
                
            except Exception as e:
                error_count += 1
                print(f"  ✗ 오류 (uid={data.get('uid', 'unknown')[:10]}...): {e}")
                continue
        
        # 최종 커밋
        db.commit()
        
        print(f"\n{'='*60}")
        print(f"✅ 적재 완료!")
        print(f"  - 삽입: {inserted_count}개")
        print(f"  - 중복 스킵: {skipped_count}개")
        print(f"  - 오류: {error_count}개")
        print(f"{'='*60}")
        
        return inserted_count
        
    except Exception as e:
        db.rollback()
        print(f"❌ DB 적재 실패: {e}")
        return 0
    finally:
        db.close()


def main():
    print("="*60)
    print("공지사항 데이터 적재")
    print("="*60)
    print()
    
    # 1. JSON 파일 로드
    print("1️⃣  JSON 파일 읽기")
    notices_data = load_json_files()
    print()
    
    if not notices_data:
        print("❌ 공지사항 데이터가 없습니다.")
        return
    
    # 2. DB에 삽입
    print("2️⃣  데이터베이스에 저장")
    insert_notices(notices_data)


if __name__ == "__main__":
    main()
