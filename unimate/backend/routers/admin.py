import os
import logging
import tempfile

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_user
from core.response import success

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/upload-pdf")
async def upload_pdf(
    file: UploadFile = File(...),
    category: str = Form("regulation"),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail={"code": "FORBIDDEN", "message": "관리자만 접근 가능합니다"},
        )

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=422,
            detail={"code": "VALIDATION_ERROR", "message": "PDF 파일만 업로드 가능합니다"},
        )

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        from langchain_community.document_loaders import PyPDFLoader
        from langchain_text_splitters import RecursiveCharacterTextSplitter

        loader = PyPDFLoader(tmp_path)
        docs = loader.load()

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=1500,
            chunk_overlap=200,
            separators=["\n\n", "\n", " ", ""],
        )
        chunks = splitter.split_documents(docs)

        from ai.embeddings import embed_pdf_chunk

        count = 0
        for chunk in chunks:
            try:
                await embed_pdf_chunk(
                    title=file.filename,
                    content=chunk.page_content,
                    category=category,
                    source_url=f"pdf://{file.filename}",
                )
                count += 1
            except Exception as e:
                logger.warning(f"청크 임베딩 실패 (계속 진행): {e}")

        return success({
            "filename": file.filename,
            "chunks_stored": count,
            "total_chunks": len(chunks),
        })

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
