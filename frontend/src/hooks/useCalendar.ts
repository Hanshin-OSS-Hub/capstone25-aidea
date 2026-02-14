/**
 * 캘린더 데이터 관리 Hook
 */

import { useState, useEffect } from 'react';
import {
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  createEventFromNotice,
} from '../lib/api-functions';

export interface CalendarEvent {
  event_id: number;
  title: string;
  start_at: string;
  end_at: string;
  memo: string | null;
  source: 'manual' | 'notice';
  notice_id: number | null;
  d_day: number;
  created_at: string;
}

export const useCalendar = (userId: number = 1) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 일정 목록 로드
  const loadEvents = async (year?: number, month?: number) => {
    try {
      setLoading(true);
      const response = await getCalendarEvents({
        user_id: userId,
        year,
        month,
      });
      if (response.success) {
        setEvents(response.data.items);
      }
    } catch (err) {
      console.error('일정 로딩 오류:', err);
      setError('일정을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 일정 생성
  const addEvent = async (data: {
    title: string;
    start_at: string;
    end_at: string;
    memo?: string;
  }) => {
    try {
      const response = await createCalendarEvent({
        user_id: userId,
        ...data,
      });
      if (response.success) {
        await loadEvents(); // 목록 새로고침
        return response.data;
      }
    } catch (err) {
      console.error('일정 생성 오류:', err);
      throw err;
    }
  };

  // 일정 수정
  const editEvent = async (
    eventId: number,
    data: {
      title?: string;
      start_at?: string;
      end_at?: string;
      memo?: string;
    }
  ) => {
    try {
      const response = await updateCalendarEvent(eventId, data, userId);
      if (response.success) {
        await loadEvents(); // 목록 새로고침
        return response.data;
      }
    } catch (err) {
      console.error('일정 수정 오류:', err);
      throw err;
    }
  };

  // 일정 삭제
  const removeEvent = async (eventId: number) => {
    try {
      const response = await deleteCalendarEvent(eventId, userId);
      if (response.success) {
        await loadEvents(); // 목록 새로고침
        return true;
      }
    } catch (err) {
      console.error('일정 삭제 오류:', err);
      throw err;
    }
  };

  // 공지사항에서 일정 생성
  const addEventFromNotice = async (noticeId: number) => {
    try {
      const response = await createEventFromNotice(userId, noticeId);
      if (response.success) {
        await loadEvents(); // 목록 새로고침
        return response.data;
      }
    } catch (err) {
      console.error('공지사항에서 일정 생성 오류:', err);
      throw err;
    }
  };

  // 초기 로딩
  useEffect(() => {
    loadEvents();
  }, [userId]);

  return {
    events,
    loading,
    error,
    loadEvents,
    addEvent,
    editEvent,
    removeEvent,
    addEventFromNotice,
  };
};
