/**
 * 공지사항 데이터 관리 Hook
 */

import { useState, useEffect, useCallback } from 'react';
import { getNotices, getDashboardFavorites, addFavorite, removeFavorite } from '../lib/api-functions';

const LOCAL_FAVORITES_KEY = 'aidea_local_favorites';

export interface Notice {
  notice_id: number;
  title: string;
  category: string;
  tags: string[];
  end_date: string | null;
  d_day: number | null;
  is_favorite: boolean;
  ai_status: string;
  original_url?: string | null;
}

export interface LocalFavorite {
  notice_id: number;
  title: string;
  category: string;
  end_date: string | null;
  d_day: number | null;
}

function getLocalFavorites(): LocalFavorite[] {
  try {
    const raw = localStorage.getItem(LOCAL_FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalFavorites(items: LocalFavorite[]) {
  localStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(items));
}

export const useNotices = (userId: number = 1) => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [favoriteNotices, setFavoriteNotices] = useState<Notice[]>([]);
  const [localFavorites, setLocalFavoritesState] = useState<LocalFavorite[]>(() => getLocalFavorites());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 공지사항 리스트 로드
  const loadNotices = async () => {
    try {
      setLoading(true);
      const response = await getNotices({ user_id: userId, page: 1, size: 100 });
      if (response.success) {
        const items = response.data?.data?.items ?? response.data?.items ?? [];
        setNotices(items);
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
        const rawItems = response.data?.data?.items ?? response.data?.items ?? [];
        const favoritesList = rawItems.map((item: any) => ({
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

  // 관심 등록 토글 (opportunity: 목업 공지 클릭 시 전달, API 실패 시 로컬 저장용)
  const toggleFavorite = useCallback(async (noticeId: number, opportunity?: { title: string; category: string; end_date?: string; daysLeft?: number }) => {
    const notice = notices.find(n => n.notice_id === noticeId);
    const inApiFavorites = favoriteNotices.some(n => n.notice_id === noticeId);
    const inLocalFavorites = localFavorites.some(n => n.notice_id === noticeId);
    const isFav = notice?.is_favorite === true || inApiFavorites || inLocalFavorites;

    if (isFav) {
      // 해제
      if (inLocalFavorites) {
        const next = localFavorites.filter(n => n.notice_id !== noticeId);
        setLocalFavoritesState(next);
        saveLocalFavorites(next);
      } else {
        try {
          await removeFavorite(noticeId, userId);
        } catch {
          // API 실패 시 로컬에서 제거 시도 (로컬에 있었을 수 있음)
          const next = localFavorites.filter(n => n.notice_id !== noticeId);
          setLocalFavoritesState(next);
          saveLocalFavorites(next);
        }
      }
    } else {
      // 등록
      try {
        await addFavorite(userId, noticeId);
      } catch {
        // API 실패(500 등): DB에 없는 목업 공지 → 로컬에 저장
        if (opportunity) {
          const item: LocalFavorite = {
            notice_id: noticeId,
            title: opportunity.title,
            category: opportunity.category,
            end_date: opportunity.end_date || null,
            d_day: typeof opportunity.daysLeft === 'number' ? opportunity.daysLeft : null,
          };
          const next = [...localFavorites.filter(n => n.notice_id !== noticeId), item];
          setLocalFavoritesState(next);
          saveLocalFavorites(next);
        }
      }
    }

    // 로컬 상태 업데이트
    setNotices(prev =>
      prev.map(n =>
        n.notice_id === noticeId
          ? { ...n, is_favorite: !isFav }
          : n
      )
    );
    await loadFavorites();
  }, [notices, favoriteNotices, localFavorites, userId]);

  // API favorites + 로컬 favorites 병합
  const mergedFavoriteNotices: Notice[] = [
    ...favoriteNotices,
    ...localFavorites.map(lf => ({
      notice_id: lf.notice_id,
      title: lf.title,
      category: lf.category,
      tags: [lf.category],
      end_date: lf.end_date,
      d_day: lf.d_day,
      is_favorite: true,
      ai_status: 'success',
    })),
  ];

  // 초기 로딩
  useEffect(() => {
    loadNotices();
    loadFavorites();
  }, [userId]);

  return {
    notices,
    favoriteNotices: mergedFavoriteNotices,
    loading,
    error,
    toggleFavorite,
    refreshNotices: loadNotices,
    refreshFavorites: loadFavorites,
  };
};
