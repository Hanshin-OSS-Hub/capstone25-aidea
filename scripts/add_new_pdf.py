#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
새 PDF 파일을 벡터 DB에 추가하는 스크립트
PDF 폴더에 새로 추가된 PDF 파일들을 벡터 DB에 반영합니다.
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

from backend.vectordb.vectordb import SchoolVectorDB

def main():
    print("="*60)
    print("새 PDF 파일을 벡터 DB에 추가")
    print("="*60)
    
    # 벡터 DB 인스턴스 생성
    db = SchoolVectorDB()
    
    # 새 PDF 파일들을 벡터 DB에 추가
    print("\nPDF 폴더의 모든 PDF 파일을 벡터 DB에 추가합니다...")
    print("(기존 DB가 없으면 전체 재생성을 수행합니다)")
    db.add_new_pdfs_to_db()
    
    print("\n" + "="*60)
    print("PDF 추가 완료!")
    print("="*60)
    
    # 테스트 검색
    print("\n테스트 검색 수행...")
    test_query = "장학금 신청"
    results = db.search(test_query, k=3, score_threshold=0.5)
    print(f"\n검색 쿼리: '{test_query}'")
    print(f"검색 결과 길이: {len(results)}자")
    print("\n검색 결과 미리보기:")
    print(results[:500] + "..." if len(results) > 500 else results)

if __name__ == "__main__":
    main()
