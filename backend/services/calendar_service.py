"""
캘린더 서비스 (비즈니스 로직)
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, date
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, extract

from backend.models import CalendarEvent, Notice, NoticeAIField


class CalendarService:
    """캘린더 비즈니스 로직"""
    
    @staticmethod
    def create_event(
        db: Session,
        user_id: int,
        title: str,
        start_at: datetime,
        end_at: datetime,
        memo: Optional[str] = None,
        source: str = "manual",
        notice_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        일정 생성
        
        Args:
            db: DB 세션
            user_id: 사용자 ID
            title: 일정 제목
            start_at: 시작 일시
            end_at: 종료 일시
            memo: 메모
            source: 출처 (manual/notice)
            notice_id: 공지사항 ID (source=notice인 경우)
        
        Returns:
            생성된 일정 정보
        """
        event = CalendarEvent(
            user_id=user_id,
            title=title,
            start_at=start_at,
            end_at=end_at,
            memo=memo,
            source=source,
            notice_id=notice_id
        )
        
        db.add(event)
        db.commit()
        db.refresh(event)
        
        return {
            "event_id": event.event_id,
            "title": event.title,
            "start_at": event.start_at.isoformat(),
            "end_at": event.end_at.isoformat(),
            "memo": event.memo,
            "source": event.source,
            "notice_id": event.notice_id,
            "created_at": event.created_at.isoformat()
        }
    
    @staticmethod
    def get_events(
        db: Session,
        user_id: int,
        year: Optional[int] = None,
        month: Optional[int] = None,
        day: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        일정 조회 (월별, 날짜별)
        
        Args:
            db: DB 세션
            user_id: 사용자 ID
            year: 연도 (옵션)
            month: 월 (옵션)
            day: 일 (옵션)
        
        Returns:
            일정 리스트
        """
        query = db.query(CalendarEvent).filter(CalendarEvent.user_id == user_id)
        
        # 연도 필터
        if year:
            query = query.filter(extract('year', CalendarEvent.start_at) == year)
        
        # 월 필터
        if month:
            query = query.filter(extract('month', CalendarEvent.start_at) == month)
        
        # 일 필터
        if day:
            query = query.filter(extract('day', CalendarEvent.start_at) == day)
        
        # 시작 시간 기준 정렬
        events = query.order_by(CalendarEvent.start_at).all()
        
        # 응답 데이터 구성
        result = []
        for event in events:
            # D-day 계산 (시작일 기준)
            d_day = (event.start_at.date() - date.today()).days
            
            item = {
                "event_id": event.event_id,
                "title": event.title,
                "start_at": event.start_at.isoformat(),
                "end_at": event.end_at.isoformat(),
                "memo": event.memo,
                "source": event.source,
                "notice_id": event.notice_id,
                "d_day": d_day,
                "created_at": event.created_at.isoformat()
            }
            result.append(item)
        
        return result
    
    @staticmethod
    def get_event_by_id(
        db: Session,
        event_id: int,
        user_id: int
    ) -> Optional[Dict[str, Any]]:
        """
        일정 상세 조회
        
        Args:
            db: DB 세션
            event_id: 일정 ID
            user_id: 사용자 ID
        
        Returns:
            일정 상세 정보 또는 None
        """
        event = db.query(CalendarEvent).filter(
            and_(
                CalendarEvent.event_id == event_id,
                CalendarEvent.user_id == user_id
            )
        ).first()
        
        if not event:
            return None
        
        return {
            "event_id": event.event_id,
            "title": event.title,
            "start_at": event.start_at.isoformat(),
            "end_at": event.end_at.isoformat(),
            "memo": event.memo,
            "source": event.source,
            "notice_id": event.notice_id,
            "created_at": event.created_at.isoformat()
        }
    
    @staticmethod
    def update_event(
        db: Session,
        event_id: int,
        user_id: int,
        title: Optional[str] = None,
        start_at: Optional[datetime] = None,
        end_at: Optional[datetime] = None,
        memo: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        일정 수정
        
        Args:
            db: DB 세션
            event_id: 일정 ID
            user_id: 사용자 ID
            title: 제목 (옵션)
            start_at: 시작 일시 (옵션)
            end_at: 종료 일시 (옵션)
            memo: 메모 (옵션)
        
        Returns:
            수정된 일정 정보 또는 None
        """
        event = db.query(CalendarEvent).filter(
            and_(
                CalendarEvent.event_id == event_id,
                CalendarEvent.user_id == user_id
            )
        ).first()
        
        if not event:
            return None
        
        # 업데이트
        if title is not None:
            event.title = title
        if start_at is not None:
            event.start_at = start_at
        if end_at is not None:
            event.end_at = end_at
        if memo is not None:
            event.memo = memo
        
        db.commit()
        db.refresh(event)
        
        return {
            "event_id": event.event_id,
            "title": event.title,
            "start_at": event.start_at.isoformat(),
            "end_at": event.end_at.isoformat(),
            "memo": event.memo,
            "source": event.source,
            "notice_id": event.notice_id,
            "created_at": event.created_at.isoformat()
        }
    
    @staticmethod
    def delete_event(
        db: Session,
        event_id: int,
        user_id: int
    ) -> bool:
        """
        일정 삭제
        
        Args:
            db: DB 세션
            event_id: 일정 ID
            user_id: 사용자 ID
        
        Returns:
            True: 삭제됨, False: 없었음
        """
        event = db.query(CalendarEvent).filter(
            and_(
                CalendarEvent.event_id == event_id,
                CalendarEvent.user_id == user_id
            )
        ).first()
        
        if not event:
            return False
        
        db.delete(event)
        db.commit()
        
        return True
    
    @staticmethod
    def create_event_from_notice(
        db: Session,
        user_id: int,
        notice_id: int
    ) -> Optional[Dict[str, Any]]:
        """
        공지사항에서 일정 자동 생성
        
        Args:
            db: DB 세션
            user_id: 사용자 ID
            notice_id: 공지사항 ID
        
        Returns:
            생성된 일정 정보 또는 None (공지사항 없음 or AI 분석 실패)
        """
        # 공지사항 조회
        notice = db.query(Notice).filter(Notice.notice_id == notice_id).first()
        if not notice:
            return None
        
        # AI 분석 결과 조회
        ai_field = db.query(NoticeAIField).filter(NoticeAIField.notice_id == notice_id).first()
        if not ai_field or ai_field.status != "success":
            return None
        
        # 날짜 정보가 없으면 생성 불가
        if not ai_field.start_date and not ai_field.end_date:
            return None
        
        # 시작일/종료일 설정
        start_date = ai_field.start_date or ai_field.end_date
        end_date = ai_field.end_date or ai_field.start_date
        
        # datetime으로 변환 (00:00:00 시작, 23:59:59 종료)
        start_at = datetime.combine(start_date, datetime.min.time())
        end_at = datetime.combine(end_date, datetime.max.time().replace(microsecond=0))
        
        # 일정 생성
        event = CalendarEvent(
            user_id=user_id,
            title=notice.title,
            start_at=start_at,
            end_at=end_at,
            memo=f"공지사항에서 생성됨\n\n{ai_field.summary[0] if ai_field.summary else ''}",
            source="notice",
            notice_id=notice_id
        )
        
        db.add(event)
        db.commit()
        db.refresh(event)
        
        return {
            "event_id": event.event_id,
            "title": event.title,
            "start_at": event.start_at.isoformat(),
            "end_at": event.end_at.isoformat(),
            "memo": event.memo,
            "source": event.source,
            "notice_id": event.notice_id,
            "created_at": event.created_at.isoformat()
        }
