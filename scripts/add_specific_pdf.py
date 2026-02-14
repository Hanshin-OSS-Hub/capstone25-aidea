#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
특정 PDF 파일을 벡터 DB에 추가하는 스크립트
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
    print("특정 PDF 파일을 벡터 DB에 추가")
    print("="*60)
    
    # 추가할 PDF 파일명
    pdf_filename = "3-19 장학규정에 관한 시행세칙 - 복사본.pdf"
    
    # 벡터 DB 인스턴스 생성
    db = SchoolVectorDB()
    
    # PDF 파일 경로 확인
    PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    PDF_DIR = os.path.join(PROJECT_ROOT, "data", "pdf")
    pdf_path = os.path.join(PDF_DIR, pdf_filename)
    
    if not os.path.exists(pdf_path):
        print(f"\n❌ 오류: PDF 파일을 찾을 수 없습니다.")
        print(f"   경로: {pdf_path}")
        return
    
    print(f"\n📄 추가할 PDF 파일: {pdf_filename}")
    print(f"   경로: {pdf_path}")
    
    # 새 PDF 파일을 벡터 DB에 추가
    print("\n벡터 DB에 추가 중...")
    db.add_new_pdfs_to_db([pdf_filename])
    
    print("\n" + "="*60)
    print("✅ PDF 추가 완료!")
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
