"""
기존 공지사항 일괄 AI 요약 생성 스크립트
실행: python generate_summaries.py [--limit N] [--dry-run]

--limit N   : N개만 처리 (기본: 전체)
--dry-run   : DB에 저장하지 않고 첫 3개만 미리보기
"""

import asyncio
import sys
import os
import argparse
import time

from dotenv import load_dotenv
load_dotenv()

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")


async def main(limit: int | None, dry_run: bool):
    from core.database import AsyncSessionLocal
    from sqlalchemy import text, update
    from models.notice import Notice
    from ai.summarize import summarize_notice

    async with AsyncSessionLocal() as session:
        # 요약이 없는 공지만 조회 (content 있는 것 우선)
        query = """
            SELECT id, title, content
            FROM notices
            WHERE (summary IS NULL OR summary = '')
              AND content IS NOT NULL AND content != ''
            ORDER BY published_at DESC
        """
        if limit:
            query += f" LIMIT {limit}"

        rows = (await session.execute(text(query))).fetchall()

    total = len(rows)
    print(f"\n요약 대상 공지: {total}개 {'(dry-run 모드)' if dry_run else ''}\n")

    if total == 0:
        print("모든 공지에 이미 요약이 있습니다.")
        return

    success_count = 0
    fail_count = 0

    for i, row in enumerate(rows, 1):
        notice_id, title, content = row.id, row.title, row.content
        print(f"[{i}/{total}] {title[:55]}...")

        try:
            summary = await summarize_notice(title, content or "")

            if dry_run:
                print(f"  [미리보기] {summary}\n")
                if i >= 3:
                    print("(dry-run: 3개 미리보기 완료. 실제 실행은 --dry-run 없이)\n")
                    break
                continue

            async with AsyncSessionLocal() as session:
                await session.execute(
                    update(Notice)
                    .where(Notice.id == notice_id)
                    .values(summary=summary)
                )
                await session.commit()

            success_count += 1
            print(f"  [OK] {summary[:80]}...")

            # OpenAI Rate Limit 방지 (분당 500 RPM)
            if i % 50 == 0:
                print("  (잠시 대기 중...)")
                await asyncio.sleep(3)
            else:
                await asyncio.sleep(0.15)

        except Exception as e:
            fail_count += 1
            print(f"  [FAIL] {type(e).__name__}: {e}")
            await asyncio.sleep(1)

    if not dry_run:
        print(f"\n완료: 성공 {success_count}개 / 실패 {fail_count}개 / 전체 {total}개")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="공지사항 AI 요약 일괄 생성")
    parser.add_argument("--limit", type=int, default=None, help="처리할 최대 공지 수")
    parser.add_argument("--dry-run", action="store_true", help="저장 없이 첫 3개 미리보기")
    args = parser.parse_args()

    asyncio.run(main(limit=args.limit, dry_run=args.dry_run))
