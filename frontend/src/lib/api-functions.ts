/**
 * API 함수 모음
 */

import { apiClient } from './api';

// ==================== 타입 정의 ====================

export interface Notice {
  notice_id: number;
  title: string;
  category: string;
  tags: string[];
  end_date: string | null;
  d_day: number | null;
  is_favorite: boolean;
  ai_status: string;
}

export interface NoticeDetail extends Notice {
  content: string;
  original_url: string;
  has_attachment: boolean;
  ai: {
    status: string;
    summary_3lines: string[];
    category: string | null;
    start_date: string | null;
    end_date: string | null;
    extracted_json: Record<string, any>;
  } | null;
}

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

export interface DashboardFavorite {
  notice_id: number;
  title: string;
  category: string;
  end_date: string | null;
  d_day: number | null;
  ai_summary_3lines: string[];
  original_url: string;
  has_attachment: boolean;
}

// ==================== 공지사항 API ====================

/**
 * 공지사항 리스트 조회
 */
export const getNotices = async (params: {
  user_id?: number;
  page?: number;
  size?: number;
  sort?: 'latest' | 'deadline';
  category?: string;
}) => {
  const response = await apiClient.get('/notices', {
    params: {
      user_id: params.user_id || 1,
      page: params.page || 1,
      size: params.size || 20,
      sort: params.sort || 'latest',
      category: params.category,
    },
  });
  return response.data;
};

/**
 * 공지사항 상세 조회
 */
export const getNoticeDetail = async (noticeId: number, userId: number = 1) => {
  const response = await apiClient.get(`/notices/${noticeId}`, {
    params: { user_id: userId },
  });
  return response.data;
};

/**
 * 공지사항 AI 요약 생성 (온디맨드)
 */
export const analyzeNotice = async (noticeId: number) => {
  const response = await apiClient.post(`/notices/${noticeId}/analyze`);
  return response.data;
};

// ==================== 관심 등록 API ====================

/**
 * 관심 공지 등록
 */
export const addFavorite = async (userId: number, noticeId: number) => {
  const response = await apiClient.post('/favorites', {
    user_id: userId,
    notice_id: noticeId,
  });
  return response.data;
};

/**
 * 관심 공지 해제
 */
export const removeFavorite = async (noticeId: number, userId: number = 1) => {
  const response = await apiClient.delete(`/favorites/${noticeId}`, {
    params: { user_id: userId },
  });
  return response.data;
};

// ==================== 대시보드 API ====================

/**
 * 대시보드 - 관심 공지 Top N
 */
export const getDashboardFavorites = async (params: {
  user_id?: number;
  limit?: number;
  sort?: 'deadline' | 'latest';
}) => {
  const response = await apiClient.get('/dashboard/favorites', {
    params: {
      user_id: params.user_id || 1,
      limit: params.limit || 5,
      sort: params.sort || 'deadline',
    },
  });
  return response.data;
};

/**
 * 대시보드 - 다가오는 일정 Top N
 */
export const getDashboardUpcomingEvents = async (params: {
  user_id?: number;
  limit?: number;
}) => {
  const response = await apiClient.get('/dashboard/upcoming-events', {
    params: {
      user_id: params.user_id || 1,
      limit: params.limit || 5,
    },
  });
  return response.data;
};

// ==================== 캘린더 API ====================

/**
 * 일정 목록 조회
 */
export const getCalendarEvents = async (params: {
  user_id?: number;
  year?: number;
  month?: number;
  day?: number;
}) => {
  const response = await apiClient.get('/calendar', {
    params: {
      user_id: params.user_id || 1,
      year: params.year,
      month: params.month,
      day: params.day,
    },
  });
  return response.data;
};

/**
 * 일정 상세 조회
 */
export const getCalendarEvent = async (eventId: number, userId: number = 1) => {
  const response = await apiClient.get(`/calendar/${eventId}`, {
    params: { user_id: userId },
  });
  return response.data;
};

/**
 * 일정 생성
 */
export const createCalendarEvent = async (data: {
  user_id: number;
  title: string;
  start_at: string;
  end_at: string;
  memo?: string;
}) => {
  const response = await apiClient.post('/calendar', data);
  return response.data;
};

/**
 * 일정 수정
 */
export const updateCalendarEvent = async (
  eventId: number,
  data: {
    title?: string;
    start_at?: string;
    end_at?: string;
    memo?: string;
  },
  userId: number = 1
) => {
  const response = await apiClient.put(`/calendar/${eventId}`, data, {
    params: { user_id: userId },
  });
  return response.data;
};

/**
 * 일정 삭제
 */
export const deleteCalendarEvent = async (eventId: number, userId: number = 1) => {
  const response = await apiClient.delete(`/calendar/${eventId}`, {
    params: { user_id: userId },
  });
  return response.data;
};

/**
 * 공지사항에서 일정 생성
 */
export const createEventFromNotice = async (userId: number, noticeId: number) => {
  const response = await apiClient.post('/calendar/from-notice', {
    user_id: userId,
    notice_id: noticeId,
  });
  return response.data;
};

// ==================== AI 채팅 API ====================

/**
 * AI 채팅
 */
export const sendAIMessage = async (userId: number, message: string) => {
  const response = await apiClient.post('/ai/chat', {
    user_id: userId,
    message: message,
  });
  return response.data;
};
