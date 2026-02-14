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
PROJECT_ROOT = os.path.dirname(os.path.dirname(BASE_DIR))  # backend/vectordb/ → 프로젝트 루트
PDF_DIR = os.path.join(PROJECT_ROOT, "data", "pdf")
INDEX_DIR = os.path.join(BASE_DIR, "faiss_index")

class SchoolVectorDB:
    def __init__(self):
        """
        벡터 DB 초기화 (OpenAI 버전)
        """
        # API 키 체크
        if not os.getenv("OPENAI_API_KEY"):
            print("[Error] .env 파일에 OPENAI_API_KEY가 없습니다!")
        
        print("[Init] OpenAI 임베딩 모델(text-embedding-3-small) 연결 중...")
        
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
                print(f"[VectorDB] 저장된 DB 로드 완료!")
            except Exception as e:
                print(f"[VectorDB] 로드 실패 (새로 생성합니다): {e}")
        else:
            print("[VectorDB] 저장된 DB가 없습니다. PDF를 학습시켜주세요.")

    def create_vector_db_from_pdfs(self):
        pdf_files = glob.glob(os.path.join(PDF_DIR, "*.pdf"))
        
        if not pdf_files:
            print(f"[VectorDB] '{PDF_DIR}' 폴더가 비어있습니다.")
            return

        print(f"[VectorDB] {len(pdf_files)}개의 PDF 파일을 학습합니다...")
        
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

        # 더 많은 컨텍스트를 위해 청크 크기 증가 (복잡한 질문 처리)
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1500,  # 1000 -> 1500으로 증가
            chunk_overlap=200,  # 100 -> 200으로 증가 (더 많은 컨텍스트 보존)
            separators=["\n\n", "\n", " ", ""]
        )
        split_docs = text_splitter.split_documents(all_docs)

        print(f"[VectorDB] OpenAI 서버로 전송하여 변환 중... (청크: {len(split_docs)}개)")
        self.vector_store = FAISS.from_documents(split_docs, self.embeddings)
        
        self.vector_store.save_local(INDEX_DIR)
        print(f"[VectorDB] 생성 완료! '{INDEX_DIR}'에 저장되었습니다.")

    def add_new_pdfs_to_db(self, pdf_filenames: List[str] = None):
        """
        기존 벡터 DB에 새 PDF 파일들을 추가합니다.
        
        Args:
            pdf_filenames: 추가할 PDF 파일명 리스트 (None이면 PDF 폴더의 모든 새 파일 추가)
        """
        if self.vector_store is None:
            print("[VectorDB] 기존 벡터 DB가 없습니다. 전체 재생성을 수행합니다.")
            self.create_vector_db_from_pdfs()
            return
        
        # 추가할 PDF 파일 목록 결정
        if pdf_filenames is None:
            # PDF 폴더의 모든 파일 가져오기
            all_pdf_files = glob.glob(os.path.join(PDF_DIR, "*.pdf"))
            pdf_filenames = [os.path.basename(f) for f in all_pdf_files]
        
        # PDF 파일 경로 생성
        pdf_paths = [os.path.join(PDF_DIR, filename) for filename in pdf_filenames]
        pdf_paths = [p for p in pdf_paths if os.path.exists(p)]
        
        if not pdf_paths:
            print(f"[VectorDB] 추가할 PDF 파일을 찾을 수 없습니다.")
            return
        
        print(f"[VectorDB] {len(pdf_paths)}개의 새 PDF 파일을 추가합니다...")
        
        all_docs = []
        for pdf_path in pdf_paths:
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
            print("[VectorDB] 추가할 문서가 없습니다.")
            return
        
        # 텍스트 분할
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1500,
            chunk_overlap=200,
            separators=["\n\n", "\n", " ", ""]
        )
        split_docs = text_splitter.split_documents(all_docs)
        
        print(f"[VectorDB] 기존 DB에 추가 중... (청크: {len(split_docs)}개)")
        self.vector_store.add_documents(split_docs)
        
        self.vector_store.save_local(INDEX_DIR)
        print(f"[VectorDB] 추가 완료! '{INDEX_DIR}'에 저장되었습니다.")

    def search(self, query: str, k: int = 8, score_threshold: float = 0.5) -> str:
        """
        벡터 DB에서 유사한 문서를 검색합니다.
        
        Args:
            query: 검색 쿼리
            k: 검색할 최대 문서 수 (기본값: 8, 복잡한 질문을 위해 증가)
            score_threshold: 유사도 점수 임계값 (0.5 이상만 반환, 더 많은 결과 포함)
        
        Returns:
            검색 결과 문자열
        """
        if self.vector_store is None:
            return "DB가 없습니다."

        # 더 많은 후보를 검색 (복잡한 질문 대비)
        results = self.vector_store.similarity_search_with_score(query, k=k * 3)
        
        # FAISS는 L2 거리를 사용하므로, 거리가 작을수록 유사도가 높음
        # 일반적으로 거리 1.0 이하는 매우 유사, 1.5 이하는 유사, 2.0 이상은 덜 유사
        # score_threshold를 거리 기준으로 변환 (낮은 거리 = 높은 유사도)
        max_distance = 2.0 - (score_threshold * 2.0)  # 0.5 -> 1.0, 0.7 -> 0.6
        
        # 점수 기반 필터링 및 정렬 (점수가 낮을수록 유사도 높음)
        filtered_results = [
            (doc, score) for doc, score in results 
            if score <= max_distance  # 거리 기준 필터링
        ]
        
        # 점수 순으로 정렬 (낮은 점수 = 높은 유사도)
        filtered_results.sort(key=lambda x: x[1])
        
        # 상위 k개만 선택
        filtered_results = filtered_results[:k]
        
        if not filtered_results:
            return "검색 결과가 없습니다. 다른 키워드로 검색해보세요."
        
        formatted_results = ""
        for i, (doc, score) in enumerate(filtered_results):
            source = doc.metadata.get("source", "Unknown")
            # 거리를 유사도 백분율로 변환 (거리 0 = 100%, 거리 2.0 = 0%)
            similarity_percent = max(0, min(100, int((2.0 - score) / 2.0 * 100)))
            formatted_results += f"\n--- [문서 {i+1}] (출처: {source}, 유사도: {similarity_percent}%) ---\n{doc.page_content}\n"
        
        return formatted_results

if __name__ == "__main__":
    db = SchoolVectorDB()
    # 최초 실행 시 아래 주석을 풀고 실행하세요
    db.create_vector_db_from_pdfs() 
    
    print(db.search("장학금 신청 기간"))