"""
공지사항 서비스 (비즈니스 로직)
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, date
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, asc, and_, or_

from backend.models import Notice, NoticeAIField, FavoriteNotice


class NoticeService:
    """공지사항 비즈니스 로직"""
    
    @staticmethod
    def get_notices_list(
        db: Session,
        user_id: int,
        page: int = 1,
        size: int = 20,
        sort: str = "latest",
        category: Optional[str] = None,
        tag: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        공지사항 리스트 조회 (페이징, 필터링, 정렬)
        
        Args:
            db: DB 세션
            user_id: 사용자 ID
            page: 페이지 번호 (1부터 시작)
            size: 페이지 크기
            sort: 정렬 (latest/deadline)
            category: 카테고리 필터
            tag: 태그 필터
        
        Returns:
            {items: [...], page, size, total}
        """
        # 기본 쿼리
        query = db.query(Notice).outerjoin(NoticeAIField)
        
        # 카테고리 필터
        if category and category != "전체":
            # 한글 카테고리 매핑
            category_map = {
                "장학": "scholarship",
                "학사": "academic",
                "행사": "event",
                "취업": "career"
            }
            category_eng = category_map.get(category, category)
            query = query.filter(Notice.category == category_eng)
        
        # 정렬
        if sort == "deadline":
            query = query.order_by(asc(NoticeAIField.end_date))
        else:  # latest
            query = query.order_by(desc(Notice.posted_date))
        
        # 전체 개수
        total = query.count()
        
        # 페이징
        offset = (page - 1) * size
        items = query.offset(offset).limit(size).all()
        
        # 관심 등록 여부 확인
        favorite_ids = {
            f.notice_id for f in 
            db.query(FavoriteNotice).filter(FavoriteNotice.user_id == user_id).all()
        }
        
        # 응답 데이터 구성
        items_data = []
        for notice in items:
            # D-day 계산
            d_day = None
            if notice.ai_field and notice.ai_field.end_date:
                diff = (notice.ai_field.end_date - date.today()).days
                d_day = diff
            
            item = {
                "notice_id": notice.notice_id,
                "title": notice.title,
                "category": notice.category_name or notice.category,
                "tags": [notice.category_name] if notice.category_name else [],
                "end_date": notice.ai_field.end_date.isoformat() if notice.ai_field and notice.ai_field.end_date else None,
                "d_day": d_day,
                "is_favorite": notice.notice_id in favorite_ids,
                "ai_status": notice.ai_field.status if notice.ai_field else "pending"
            }
            items_data.append(item)
        
        return {
            "items": items_data,
            "page": page,
            "size": size,
            "total": total
        }
    
    @staticmethod
    def get_notice_detail(
        db: Session,
        notice_id: int,
        user_id: int
    ) -> Optional[Dict[str, Any]]:
        """
        공지사항 상세 조회
        
        Args:
            db: DB 세션
            notice_id: 공지사항 ID
            user_id: 사용자 ID
        
        Returns:
            공지사항 상세 정보 또는 None
        """
        notice = db.query(Notice).options(
            joinedload(Notice.ai_field)
        ).filter(Notice.notice_id == notice_id).first()
        
        if not notice:
            return None
        
        # 관심 등록 여부
        is_favorite = db.query(FavoriteNotice).filter(
            and_(
                FavoriteNotice.user_id == user_id,
                FavoriteNotice.notice_id == notice_id
            )
        ).first() is not None
        
        # AI 분석 결과
        ai_data = None
        if notice.ai_field and notice.ai_field.status == "success":
            ai_data = {
                "status": notice.ai_field.status,
                "summary_3lines": notice.ai_field.summary or [],
                "category": notice.ai_field.ai_category,
                "start_date": notice.ai_field.start_date.isoformat() if notice.ai_field.start_date else None,
                "end_date": notice.ai_field.end_date.isoformat() if notice.ai_field.end_date else None,
                "extracted_json": notice.ai_field.extracted_json or {}
            }
        elif notice.ai_field:
            ai_data = {
                "status": notice.ai_field.status,
                "summary_3lines": [],
                "category": None,
                "start_date": None,
                "end_date": None,
                "extracted_json": {}
            }
        
        return {
            "notice_id": notice.notice_id,
            "title": notice.title,
            "content": notice.content,
            "original_url": notice.original_url,
            "has_attachment": notice.has_attachment,
            "tags": [notice.category_name] if notice.category_name else [],
            "is_favorite": is_favorite,
            "ai": ai_data
        }
    
    @staticmethod
    def add_favorite(
        db: Session,
        user_id: int,
        notice_id: int
    ) -> bool:
        """
        관심 공지 등록
        
        Returns:
            True: 새로 등록됨, False: 이미 등록되어 있음 (중복)
        """
        # 중복 확인
        existing = db.query(FavoriteNotice).filter(
            and_(
                FavoriteNotice.user_id == user_id,
                FavoriteNotice.notice_id == notice_id
            )
        ).first()
        
        if existing:
            return False
        
        # 새로 등록
        favorite = FavoriteNotice(
            user_id=user_id,
            notice_id=notice_id
        )
        db.add(favorite)
        db.commit()
        
        return True
    
    @staticmethod
    def remove_favorite(
        db: Session,
        user_id: int,
        notice_id: int
    ) -> bool:
        """
        관심 공지 해제
        
        Returns:
            True: 삭제됨, False: 없었음
        """
        favorite = db.query(FavoriteNotice).filter(
            and_(
                FavoriteNotice.user_id == user_id,
                FavoriteNotice.notice_id == notice_id
            )
        ).first()
        
        if not favorite:
            return False
        
        db.delete(favorite)
        db.commit()
        
        return True
    
    @staticmethod
    def get_dashboard_favorites(
        db: Session,
        user_id: int,
        limit: int = 5,
        sort: str = "deadline"
    ) -> List[Dict[str, Any]]:
        """
        대시보드용 관심 공지 Top N
        
        Args:
            db: DB 세션
            user_id: 사용자 ID
            limit: 개수 제한
            sort: 정렬 (deadline/latest)
        
        Returns:
            공지사항 카드 데이터 리스트
        """
        query = db.query(Notice).join(FavoriteNotice).outerjoin(NoticeAIField).filter(
            FavoriteNotice.user_id == user_id
        )
        
        # 정렬
        if sort == "deadline":
            query = query.order_by(asc(NoticeAIField.end_date))
        else:
            query = query.order_by(desc(Notice.posted_date))
        
        notices = query.limit(limit).all()
        
        # 응답 데이터 구성
        result = []
        for notice in notices:
            # D-day 계산
            d_day = None
            if notice.ai_field and notice.ai_field.end_date:
                diff = (notice.ai_field.end_date - date.today()).days
                d_day = diff
            
            item = {
                "notice_id": notice.notice_id,
                "title": notice.title,
                "category": notice.category_name or notice.category,
                "end_date": notice.ai_field.end_date.isoformat() if notice.ai_field and notice.ai_field.end_date else None,
                "d_day": d_day,
                "ai_summary_3lines": notice.ai_field.summary if notice.ai_field and notice.ai_field.status == "success" else [],
                "original_url": notice.original_url,
                "has_attachment": notice.has_attachment
            }
            result.append(item)
        
        return result
