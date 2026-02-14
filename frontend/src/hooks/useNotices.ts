/**
 * 공지사항 데이터 관리 Hook
 */

import { useState, useEffect } from 'react';
import { getNotices, getDashboardFavorites, addFavorite, removeFavorite } from '../lib/api-functions';

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

export const useNotices = (userId: number = 1) => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [favoriteNotices, setFavoriteNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 공지사항 리스트 로드
  const loadNotices = async () => {
    try {
      setLoading(true);
      const response = await getNotices({ user_id: userId, page: 1, size: 100 });
      if (response.success) {
        setNotices(response.data.items);
      }
    } catch (err) {
      console.error('공지사항 로딩 오류:', err);
      setError('공지사항을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 관심 공지사항 로드
  const loadFavorites = async () => {
    try {
      const response = await getDashboardFavorites({ user_id: userId, limit: 100 });
      if (response.success) {
        // DashboardFavorite를 Notice 형식으로 변환
        const favoritesList = response.data.items.map((item: any) => ({
          notice_id: item.notice_id,
          title: item.title,
          category: item.category,
          tags: [item.category],
          end_date: item.end_date,
          d_day: item.d_day,
          is_favorite: true,
          ai_status: 'success',
        }));
        setFavoriteNotices(favoritesList);
      }
    } catch (err) {
      console.error('관심 공지사항 로딩 오류:', err);
    }
  };

  // 관심 등록 토글
  const toggleFavorite = async (noticeId: number) => {
    try {
      const notice = notices.find(n => n.notice_id === noticeId);
      if (!notice) return;

      if (notice.is_favorite) {
        // 관심 해제
        await removeFavorite(noticeId, userId);
      } else {
        // 관심 등록
        await addFavorite(userId, noticeId);
      }

      // 로컬 상태 업데이트
      setNotices(prev =>
        prev.map(n =>
          n.notice_id === noticeId
            ? { ...n, is_favorite: !n.is_favorite }
            : n
        )
      );

      // 관심 공지사항 리스트 새로고침
      await loadFavorites();
    } catch (err) {
      console.error('관심 등록/해제 오류:', err);
      // 에러 발생시 원래대로 되돌림
      await loadNotices();
      await loadFavorites();
    }
  };

  // 초기 로딩
  useEffect(() => {
    loadNotices();
    loadFavorites();
  }, [userId]);

  return {
    notices,
    favoriteNotices,
    loading,
    error,
    toggleFavorite,
    refreshNotices: loadNotices,
    refreshFavorites: loadFavorites,
  };
};
