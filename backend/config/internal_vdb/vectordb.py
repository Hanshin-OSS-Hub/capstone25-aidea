import os
import glob
from typing import List, Dict
from dotenv import load_dotenv

# .env 파일 로드 (API 키 불러오기)
load_dotenv()

# ▼▼▼ [OpenAI로 변경] ▼▼▼
from langchain_openai import OpenAIEmbeddings
# ▲▲▲ [변경 완료] ▲▲▲

from langchain_community.vectorstores import FAISS
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

# 경로 설정
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PDF_DIR = os.path.join(BASE_DIR, "pdf")
INDEX_DIR = os.path.join(BASE_DIR, "faiss_index")

class SchoolVectorDB:
    def __init__(self):
        """
        벡터 DB 초기화 (OpenAI 버전)
        """
        # API 키 체크
        if not os.getenv("OPENAI_API_KEY"):
            print("❌ [Error] .env 파일에 OPENAI_API_KEY가 없습니다!")
        
        print("🔄 [Init] OpenAI 임베딩 모델(text-embedding-3-small) 연결 중...")
        
        # ▼▼▼ [OpenAI 모델 설정] ▼▼▼
        self.embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
        # ▲▲▲ [설정 완료] ▲▲▲
        
        self.vector_store = None
        self._load_vector_store()

    def _load_vector_store(self):
        if os.path.exists(INDEX_DIR):
            try:
                self.vector_store = FAISS.load_local(
                    INDEX_DIR, 
                    self.embeddings, 
                    allow_dangerous_deserialization=True
                )
                print(f"✅ [VectorDB] 저장된 DB 로드 완료!")
            except Exception as e:
                print(f"⚠️ [VectorDB] 로드 실패 (새로 생성합니다): {e}")
        else:
            print("ℹ️ [VectorDB] 저장된 DB가 없습니다. PDF를 학습시켜주세요.")

    def create_vector_db_from_pdfs(self):
        pdf_files = glob.glob(os.path.join(PDF_DIR, "*.pdf"))
        
        if not pdf_files:
            print(f"⚠️ [VectorDB] '{PDF_DIR}' 폴더가 비어있습니다.")
            return

        print(f"🔄 [VectorDB] {len(pdf_files)}개의 PDF 파일을 학습합니다...")
        
        all_docs = []
        for pdf_path in pdf_files:
            try:
                loader = PyPDFLoader(pdf_path)
                docs = loader.load()
                for doc in docs:
                    doc.metadata["source"] = os.path.basename(pdf_path)
                print(f"   - 읽음: {os.path.basename(pdf_path)}")
                all_docs.extend(docs)
            except Exception as e:
                print(f"   - 에러: {os.path.basename(pdf_path)} ({e})")

        if not all_docs:
            return

        # OpenAI는 성능이 좋아서 1000자 단위로 잘라도 잘 인식합니다.
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=100,
            separators=["\n\n", "\n", " ", ""]
        )
        split_docs = text_splitter.split_documents(all_docs)

        print(f"🔄 [VectorDB] OpenAI 서버로 전송하여 변환 중... (청크: {len(split_docs)}개)")
        self.vector_store = FAISS.from_documents(split_docs, self.embeddings)
        
        self.vector_store.save_local(INDEX_DIR)
        print(f"✅ [VectorDB] 생성 완료! '{INDEX_DIR}'에 저장되었습니다.")

    def search(self, query: str, k: int = 3) -> str:
        if self.vector_store is None:
            return "DB가 없습니다."

        results = self.vector_store.similarity_search_with_score(query, k=k)
        print(results)
        formatted_results = ""
        for i, (doc, score) in enumerate(results):
            source = doc.metadata.get("source", "Unknown")
            formatted_results += f"\n--- [문서 {i+1}] (출처: {source}) ---\n{doc.page_content}\n"
        
        return formatted_results

if __name__ == "__main__":
    db = SchoolVectorDB()
    # 최초 실행 시 아래 주석을 풀고 실행하세요
    db.create_vector_db_from_pdfs() 
    
    print(db.search("장학금 신청 기간"))