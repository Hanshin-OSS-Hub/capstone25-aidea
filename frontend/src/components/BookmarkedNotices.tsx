import React from 'react';
import { Bookmark } from 'lucide-react';
import { OpportunityCard } from './OpportunityCard';

interface BookmarkedNoticesProps {
  bookmarkedNotices?: any[];
  onNoticeClick?: (id: number) => void;
}

export function BookmarkedNotices({ bookmarkedNotices, onNoticeClick }: BookmarkedNoticesProps = {}) {
  // Mock data for demonstration
  const mockBookmarkedNotices = [
    {
      id: 1,
      title: '2024학년도 2학기 국가장학금 신청',
      category: '장학금',
      deadline: '2024-02-28',
      daysLeft: 3,
      description: '소득 8분위 이하 대학생 대상 국가장학금 신청 기간입니다.',
      uploadDate: '2024-02-18',
    },
    {
      id: 2,
      title: '제15회 대학생 창업경진대회',
      category: '공모전',
      deadline: '2024-03-05',
      daysLeft: 10,
      description: '혁신적인 아이디어를 가진 대학생 창업팀을 모집합니다.',
      uploadDate: '2024-02-17',
    },
    {
      id: 3,
      title: '2024 봄학기 교환학생 프로그램 안내',
      category: '공지사항',
      deadline: '2024-02-25',
      daysLeft: 1,
      description: '유럽 및 아시아 자매대학 교환학생 프로그램 신청 안내',
      uploadDate: '2024-02-19',
    },
  ];

  const notices = bookmarkedNotices && bookmarkedNotices.length > 0 
    ? bookmarkedNotices 
    : mockBookmarkedNotices;

  // Sort by upload date (latest first)
  const sortedNotices = [...notices].sort((a, b) => {
    return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center space-x-3 mb-2">
        <Bookmark className="w-8 h-8 text-purple-600" />
        <h1 className="text-3xl font-bold text-gray-900">관심 공지</h1>
      </div>
      <p className="text-gray-600 mb-8">내가 관심 등록한 공지사항을 모아볼 수 있습니다</p>

      {sortedNotices.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedNotices.map(notice => (
            <OpportunityCard
              key={notice.id}
              opportunity={notice}
              onClick={onNoticeClick ? () => onNoticeClick(notice.id) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
          <Bookmark className="w-20 h-20 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-2">아직 관심 등록한 공지가 없습니다</p>
          <p className="text-sm text-gray-400">공지 상세 페이지에서 "관심 공지 등록하기"를 클릭해보세요</p>
        </div>
      )}
    </div>
  );
}
