"""
pdfs/ 폴더의 PDF 파일을 qa_documents 테이블에 임베딩하는 스크립트
실행: python -X utf8 load_pdfs.py [--dry-run]

--dry-run : 실제 저장 없이 청크 수만 미리보기
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

PDF_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pdfs")
CATEGORY = "regulation"
CHUNK_SIZE = 1500
CHUNK_OVERLAP = 200


async def process_pdf(pdf_path: str, dry_run: bool) -> int:
    from langchain_community.document_loaders import PyPDFLoader
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    from ai.embeddings import embed_pdf_chunk
    from core.database import AsyncSessionLocal
    from sqlalchemy import text

    filename = os.path.basename(pdf_path)

    loader = PyPDFLoader(pdf_path)
    docs = loader.load()

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", " ", ""],
    )
    chunks = splitter.split_documents(docs)
    print(f"  청크 수: {len(chunks)}개")

    if dry_run:
        for i, chunk in enumerate(chunks[:2], 1):
            print(f"  [청크 {i}] {chunk.page_content[:100]}...")
        return 0

    # 기존 동일 파일 청크 삭제 (재업로드 시 중복 방지)
    async with AsyncSessionLocal() as session:
        deleted = await session.execute(
            text("DELETE FROM qa_documents WHERE source_url = :url"),
            {"url": f"pdf://{filename}"},
        )
        await session.commit()
        if deleted.rowcount:
            print(f"  기존 청크 {deleted.rowcount}개 삭제 후 재업로드")

    success_count = 0
    for i, chunk in enumerate(chunks, 1):
        try:
            await embed_pdf_chunk(
                title=filename,
                content=chunk.page_content,
                category=CATEGORY,
                source_url=f"pdf://{filename}",
            )
            success_count += 1
            if i % 20 == 0:
                print(f"  진행 중... {i}/{len(chunks)}")
                await asyncio.sleep(1)
            else:
                await asyncio.sleep(0.2)
        except Exception as e:
            print(f"  [FAIL] 청크 {i}: {e}")
            await asyncio.sleep(1)

    return success_count


async def main(dry_run: bool):
    if not os.path.exists(PDF_DIR):
        print(f"pdfs/ 폴더가 없습니다: {PDF_DIR}")
        return

    pdf_files = [f for f in os.listdir(PDF_DIR) if f.lower().endswith(".pdf")]

    if not pdf_files:
        print("pdfs/ 폴더에 PDF 파일이 없습니다.")
        print(f"  폴더 위치: {PDF_DIR}")
        return

    print(f"PDF 파일 {len(pdf_files)}개 발견 {'(dry-run)' if dry_run else ''}\n")

    total = 0
    for filename in pdf_files:
        pdf_path = os.path.join(PDF_DIR, filename)
        print(f"[처리 중] {filename}")
        count = await process_pdf(pdf_path, dry_run)
        if not dry_run:
            print(f"  [완료] {count}개 청크 저장")
            total += count
        print()

    if not dry_run:
        print(f"전체 완료: {total}개 청크가 qa_documents에 저장됐습니다.")
        print("이제 AI 챗봇이 학사규정을 참고해 답변합니다.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="pdfs/ 폴더의 PDF를 qa_documents에 임베딩")
    parser.add_argument("--dry-run", action="store_true", help="저장 없이 미리보기만")
    args = parser.parse_args()

    asyncio.run(main(dry_run=args.dry_run))
