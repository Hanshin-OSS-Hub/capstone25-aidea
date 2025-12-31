import os
import glob
from typing import List, Dict

# ▼▼▼ [무료 모델 사용을 위한 변경] ▼▼▼
# OpenAI 대신 HuggingFaceEmbeddings를 가져옵니다.
from langchain_huggingface import HuggingFaceEmbeddings
# ▲▲▲ [여기까지] ▲▲▲

from langchain_community.vectorstores import FAISS
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

# 경로 설정 (현재 파일 기준)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PDF_DIR = os.path.join(BASE_DIR, "pdf")           # PDF 파일 넣는 곳
INDEX_DIR = os.path.join(BASE_DIR, "faiss_index") # 벡터 DB 저장될 곳

class SchoolVectorDB:
    def __init__(self):
        """
        벡터 DB 초기화 (무료 버전)
        """
        print("🔄 [Init] 무료 임베딩 모델(HuggingFace)을 로드 중입니다... (시간이 조금 걸릴 수 있음)")
        
        # ▼▼▼ [핵심 변경] OpenAIEmbeddings -> HuggingFaceEmbeddings ▼▼▼
        # 한국어 성능이 우수한 'jhgan/ko-sroberta-multitask' 모델을 사용합니다.
        # 내 컴퓨터의 CPU/GPU를 사용하므로 API 키나 비용이 필요 없습니다.
        self.embeddings = HuggingFaceEmbeddings(
            model_name="jhgan/ko-sroberta-multitask",
            model_kwargs={'device': 'cpu'}, # GPU가 있다면 'cuda'로 변경 가능
            encode_kwargs={'normalize_embeddings': True}
        )
        # ▲▲▲ [여기까지] ▲▲▲
        
        self.vector_store = None
        self._load_vector_store()

    def _load_vector_store(self):
        """로컬에 저장된 FAISS 인덱스를 불러옵니다."""
        if os.path.exists(INDEX_DIR):
            try:
                self.vector_store = FAISS.load_local(
                    INDEX_DIR, 
                    self.embeddings, 
                    allow_dangerous_deserialization=True
                )
                print(f"✅ [VectorDB] 저장된 DB를 '{INDEX_DIR}'에서 로드했습니다.")
            except Exception as e:
                print(f"⚠️ [VectorDB] 로드 실패 (새로 생성합니다): {e}")
        else:
            print("ℹ️ [VectorDB] 저장된 DB가 없습니다. PDF를 추가해주세요.")

    def create_vector_db_from_pdfs(self):
        """
        pdf 폴더에 있는 모든 PDF 파일을 읽어서 벡터 DB를 새로 만듭니다.
        """
        pdf_files = glob.glob(os.path.join(PDF_DIR, "*.pdf"))
        
        if not pdf_files:
            print(f"⚠️ [VectorDB] '{PDF_DIR}' 폴더에 PDF 파일이 없습니다.")
            return

        print(f"🔄 [VectorDB] {len(pdf_files)}개의 PDF 파일을 학습합니다...")
        
        all_docs = []
        for pdf_path in pdf_files:
            try:
                loader = PyPDFLoader(pdf_path)
                docs = loader.load()
                # 메타데이터에 파일명 추가
                for doc in docs:
                    doc.metadata["source"] = os.path.basename(pdf_path)
                    
                print(f"   - 읽음: {os.path.basename(pdf_path)}")
                all_docs.extend(docs)
            except Exception as e:
                print(f"   - 에러 발생 ({os.path.basename(pdf_path)}): {e}")

        if not all_docs:
            return

        # 텍스트 청킹 (Chunking)
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,  # 무료 모델은 입력 길이가 짧으므로 500자 정도로 줄임
            chunk_overlap=50,
            separators=["\n\n", "\n", " ", ""]
        )
        split_docs = text_splitter.split_documents(all_docs)

        # 임베딩 및 저장 (새로 생성)
        print(f"🔄 [VectorDB] 벡터 변환 중... (청크 개수: {len(split_docs)}개)")
        print("   (내 컴퓨터 CPU로 계산하므로 PDF가 많으면 시간이 좀 걸립니다 ☕)")
        
        self.vector_store = FAISS.from_documents(split_docs, self.embeddings)
        
        # 로컬 저장
        self.vector_store.save_local(INDEX_DIR)
        print(f"✅ [VectorDB] 생성 완료! '{INDEX_DIR}'에 저장되었습니다.")

    def search(self, query: str, k: int = 3) -> str:
        """
        질문과 유사한 내용을 검색합니다.
        """
        if self.vector_store is None:
            return "데이터베이스가 비어있습니다."

        # 유사도 검색
        results = self.vector_store.similarity_search_with_score(query, k=k)
        
        formatted_results = ""
        for i, (doc, score) in enumerate(results):
            source_file = doc.metadata.get("source", "알수없음")
            formatted_results += f"\n--- [문서 {i+1}] (출처: {source_file}) ---\n"
            formatted_results += f"{doc.page_content}\n"
        
        return formatted_results

# --- [테스트 실행 영역] ---
if __name__ == "__main__":
    db = SchoolVectorDB()

    # PDF가 있다면 DB 생성 실행
    db.create_vector_db_from_pdfs() 

    # 검색 테스트
    query = "장학금 신청 기간 알려줘"
    print(f"\n🔍 질문: {query}")
    answer = db.search(query)
    print(f"\n💡 검색 결과:\n{answer}")