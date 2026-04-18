"""
qa_documents 테이블 시딩 스크립트
장학/학사 카테고리 공지를 QA 문서로 변환해서 벡터 검색에 사용할 수 있게 합니다.
실행: python seed_qa_documents.py [--dry-run]

나중에 실제 학사요람/장학규정 PDF가 생기면:
  POST /api/v1/admin/upload-pdf (admin 계정 필요)
로 업로드하면 됩니다.
"""

import asyncio
import sys
import os
import argparse

from dotenv import load_dotenv
load_dotenv()

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

# QA 문서로 변환할 카테고리 (학사/장학 위주)
TARGET_CATEGORIES = ["scholarship", "academic", "notice"]

# 컨텐츠 최소 길이 (너무 짧은 공지는 제외)
MIN_CONTENT_LEN = 100


async def main(dry_run: bool):
    from core.database import AsyncSessionLocal
    from sqlalchemy import text
    from ai.embeddings import embed_pdf_chunk

    # 이미 시딩된 source_url 목록 조회 (중복 방지)
    async with AsyncSessionLocal() as session:
        existing = await session.execute(
            text("SELECT source_url FROM qa_documents WHERE source_url LIKE 'notice://%'")
        )
        existing_urls = {row[0] for row in existing.fetchall()}

    print(f"기존 QA 문서 (notice://): {len(existing_urls)}개\n")

    # 대상 공지 조회
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(text("""
            SELECT id, title, content, category, source_url
            FROM notices
            WHERE category = ANY(:cats)
              AND content IS NOT NULL
              AND LENGTH(content) >= :min_len
            ORDER BY published_at DESC
            LIMIT 500
        """), {"cats": TARGET_CATEGORIES, "min_len": MIN_CONTENT_LEN})).fetchall()

    # 이미 처리된 것 제외
    to_process = [
        r for r in rows
        if f"notice://{r.id}" not in existing_urls
    ]

    print(f"신규 시딩 대상: {len(to_process)}개 (전체 {len(rows)}개 중)")

    if dry_run:
        print("\n[dry-run] 처음 3개 미리보기:\n")
        for r in to_process[:3]:
            print(f"  제목: {r.title[:60]}")
            print(f"  카테고리: {r.category}")
            print(f"  내용 길이: {len(r.content)}자")
            print(f"  source_url: notice://{r.id}\n")
        print("(실제 실행은 --dry-run 없이)")
        return

    if len(to_process) == 0:
        print("시딩할 새 문서가 없습니다.")
        return

    success_count = 0
    fail_count = 0

    for i, row in enumerate(to_process, 1):
        print(f"[{i}/{len(to_process)}] {row.title[:55]}... ({row.category})")
        try:
            await embed_pdf_chunk(
                title=row.title,
                content=row.content[:3000],
                category=row.category,
                source_url=f"notice://{row.id}",
            )
            success_count += 1
            print(f"  [OK]")

            # Rate limit 방지
            if i % 30 == 0:
                print("  (잠시 대기 중...)")
                await asyncio.sleep(3)
            else:
                await asyncio.sleep(0.2)

        except Exception as e:
            fail_count += 1
            print(f"  [FAIL] {type(e).__name__}: {e}")
            await asyncio.sleep(1)

    print(f"\n완료: 성공 {success_count}개 / 실패 {fail_count}개 / 전체 {len(to_process)}개")
    print("\nqa_documents에 데이터가 추가됐습니다. answer_faq 툴이 이제 검색 결과를 반환합니다.")
    print("\n[다음 단계] 실제 학사요람/장학규정 PDF가 있다면:")
    print("  POST /api/v1/admin/upload-pdf 로 업로드하면 고품질 FAQ 답변이 가능합니다.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="공지 데이터로 qa_documents 시딩")
    parser.add_argument("--dry-run", action="store_true", help="저장 없이 미리보기만")
    args = parser.parse_args()

    asyncio.run(main(dry_run=args.dry_run))
